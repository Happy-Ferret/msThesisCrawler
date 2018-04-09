/*
 Copyright (C) 2017-present  John Berlin <n0tan3rd@gmail.com>
 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const fs = require('fs-extra')
const NavigationMan = require('./navigationMan')
const Launcher = require('./launcher')
const checkRedir = require('./checkRedir')

class Crawler {
  constructor (toCrawl) {
    this.navMan = new NavigationMan()
    this.toCrawl = toCrawl
    this.client = null
    this.serialize = this.newSerialize('')
    this.crawled = 0
    this.doIt = true
    this.navigated = false
    this.measure = false
    this.logFile = process.env.logFile
    this.dumpDir = process.env.dataDumpDir
    this.next = this.next.bind(this)
    this.nextRedir = this.nextRedir.bind(this)
    this.didNav = this.didNav.bind(this)
    this.die = this.die.bind(this)
  }

  async die () {
    await this.client.Browser.close()
    await this.client.close()
    this.navMan.removeAllListeners()
    await this.init()
    this.nextNoDeathCheck()
  }

  newSerialize (link) {
    return {
      link,
      requestsMade: 0,
      failed: [],
      console: [],
      exceptions: []
    }
  }

  newSerializeRedir (link, redired) {
    if (this.serialize.redir) {
      return {
        link,
        redir: [...this.serialize.redir, redired],
        requestsMade: 0,
        failed: [],
        console: [],
        exceptions: []
      }
    } else {
      return {
        link,
        redir: [redired],
        requestsMade: 0,
        failed: [],
        console: [],
        exceptions: []
      }
    }
  }

  async init () {
    this.client = await Launcher.launch({
      connect: {
        host: 'localhost',
        port: 9222,
        remote: true
      },
      userDataDir: process.env.chromeDataDir
    })
    await this.client.Runtime.enable()
    await this.client.Page.enable()
    await this.client.Network.enable()
    await this.client.Animation.setPlaybackRate({ playbackRate: 1000 })

    if (process.env.withClientSide) {
      await this.client.Page.addScriptToEvaluateOnNewDocument({
        source: `(${require('./injectYesClientSide').toString()})();`
      })
    } else {
      await this.client.Page.addScriptToEvaluateOnNewDocument(
        require('./injectNoClientSide')
      )
    }

    await this.client.Page.setDownloadBehavior({ behavior: 'deny' })

    this.client.Network.requestWillBeSent(info => {
      if (this.measure) {
        this.navMan.reqStarted(info)
      }
      this.serialize.requestsMade += 1
    })

    this.client.Network.loadingFinished(info => {
      if (this.measure) {
        this.navMan.reqFinished(info)
      }
    })

    this.client.Network.loadingFailed(info => {
      if (this.measure) {
        this.navMan.reqFinished(info)
      }
      this.serialize.failed.push(info)
    })

    this.client.Runtime.consoleAPICalled(info => {
      this.serialize.console.push(info)
    })

    this.client.Runtime.exceptionThrown(info => {
      this.serialize.exceptions.push(info)
    })

    this.navMan.on('network-idle', async () => {
      console.log('idle')
      if (this.doIt && this.navigated) {
        this.measure = false
        this.doIt = false
        let redirLink = await this.checkIfRedir()
        if (redirLink) {
          console.log('redirect')
          await this.client.Page.stopLoading()
          process.nextTick(() => this.nextRedir(redirLink))
        } else {
          await this.lastWait()
          await fs.writeJSON(
            `${this.dumpDir}/${this.crawled}.json`,
            this.serialize
          )
          await this.client.Page.stopLoading()
          process.nextTick(this.next)
        }
      }
    })

    this.navMan.on('global-to', async () => {
      console.log('global-to')
      if (this.doIt && this.navigated) {
        this.doIt = false
        this.measure = false
        let redirLink = await this.checkIfRedir()
        if (redirLink) {
          console.log('redirect')
          await this.client.Page.stopLoading()
          process.nextTick(() => this.nextRedir(redirLink))
        } else {
          await this.lastWait()
          await fs.writeJSON(
            `${this.dumpDir}/${this.crawled}.json`,
            this.serialize
          )
          await this.client.Page.stopLoading()
          process.nextTick(this.next)
        }
      }
    })

    this.navMan.on('navigation-timedout', async () => {
      if (this.doIt) {
        this.measure = false
        this.doIt = false
        console.log('nav to')
        let redirLink = await this.checkIfRedir()
        if (redirLink) {
          console.log('redirect')
          await this.client.Page.stopLoading()
          this.nextRedir(redirLink)
        } else {
          await this.client.Page.stopLoading()
          await fs.appendFile(this.logFile, `${this.serialize.link} to\n`)
          this.next()
        }
      }
    })
  }

  next () {
    if (this.crawled % 60 === 0) {
      process.nextTick(this.die)
    } else {
      let next = this.getNextLink()
      if (next) {
        let referrer = next.replace(
          /([^0-9])(\d+)\/(.+)/,
          (match, p1, p2, p3, offset, string) => `${p1}*/${p3}`
        )
        console.log(next, this.crawled)
        const to = { url: next, referrer }
        this.serialize = this.newSerialize(next)
        this.client.Page.navigate(to, this.didNav)
        this.navMan.startedNav(next)
        this.doIt = true
      } else {
        process.exit()
      }
    }
  }

  nextNoDeathCheck () {
    let next = this.getNextLink()
    if (next) {
      let referrer = next.replace(
        /([^0-9])(\d+)\/(.+)/,
        (match, p1, p2, p3, offset, string) => `${p1}*/${p3}`
      )
      console.log(next, this.crawled)
      const to = { url: next, referrer }
      this.serialize = this.newSerialize(next)
      this.client.Page.navigate(to, this.didNav)
      this.navMan.startedNav(next)
      this.doIt = true
    } else {
      process.exit()
    }
  }

  didNav (info) {
    console.log('did navigate')
    this.navigated = true
    this.measure = true
    this.navMan.didNavigate()
  }

  getNextLink () {
    let next = this.toCrawl.shift()
    if (next) {
      if (next.c) {
        this.crawled = next.c
        return next.link
      } else {
        this.crawled += 1
        return next
      }
    }
    return next
  }

  nextRedir (link) {
    if (!this.serialize.redir) {
      this.doIt = true
      const to = { url: link, referrer: this.serialize.link }
      console.log(link)
      this.serialize = this.newSerializeRedir(link, this.serialize.link)
      this.client.Page.navigate(to, this.didNav)
      this.navMan.startedNav(link)
    } else if (this.serialize.redir && this.serialize.redir.length <= 3) {
      this.doIt = true
      const to = { url: link, referrer: this.serialize.link }
      console.log(link)
      this.serialize = this.newSerializeRedir(link, this.serialize.link)
      this.client.Page.navigate(to, this.didNav)
      this.navMan.startedNav(link)
    } else {
      this.next()
    }
  }

  lastWait () {
    return new Promise(resolve => {
      setTimeout(resolve, 5000)
    })
  }

  async checkIfRedir () {
    try {
      let exists = await this.client.Runtime.evaluate(checkRedir)
      return exists.result.value
    } catch (error) {
      return undefined
    }
  }
}

module.exports = Crawler
