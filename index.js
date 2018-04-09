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

require('dotenv').config()
const fs = require('fs-extra')
const Crawler = require('./lib')

async function doIt () {
  const seeds = await fs.readJson(process.env.seedList)
  const crawler = new Crawler(seeds)
  await crawler.init()
  crawler.nextNoDeathCheck()
}

doIt().catch(error => {
  console.error(error)
})