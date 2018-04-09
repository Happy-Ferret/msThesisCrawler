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

module.exports = {
  source: `(function inject () {
  try {
    Object.defineProperty(window, 'onbeforeunload', {
      configurable: false,
      writeable: false,
      value: function () {}
    })
    Object.defineProperty(window, 'onunload', {
      configurable: false,
      writeable: false,
      value: function () {}
    })
    window.alert = function () {}
    window.confirm = function () {}
    window.prompt = function () {}
  } catch (error) {}
  let scrollingTO = 2000
  let lastScrolled = undefined
  let scrollerInterval = undefined
  if (document) {
    document.addEventListener('DOMContentLoaded', () => {
      lastScrolled = Date.now()
      let scrollCount = 0
      let maxScroll
      if (document && document.body) {
        maxScroll = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
      }
      scrollerInterval = setInterval(() => {
        let scrollPos = window.scrollY + window.innerHeight
        if (document && document.body) {
          if (scrollCount < 25) {
            maxScroll = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
            scrollCount += 1
            if (scrollPos < maxScroll) {
              window.scrollBy(0, 1000)
              lastScrolled = Date.now()
            } else {
              clearInterval(scrollerInterval)
              scrollerInterval = undefined
            }
          } else {
            if (scrollerInterval) {
              clearInterval(scrollerInterval)
              scrollerInterval = undefined
            }
          }

        }
      }, 1000)
    })
  }
})();
  `
}
