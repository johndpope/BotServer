/*****************************************************************************\
|                                               ( )_  _                       |
|    _ _    _ __   _ _    __    ___ ___     _ _ | ,_)(_)  ___   ___     _     |
|   ( '_`\ ( '__)/'_` ) /'_ `\/' _ ` _ `\ /'_` )| |  | |/',__)/' v `\ /'_`\   |
|   | (_) )| |  ( (_| |( (_) || ( ) ( ) |( (_| || |_ | |\__,\| (˅) |( (_) )  |
|   | ,__/'(_)  `\__,_)`\__  |(_) (_) (_)`\__,_)`\__)(_)(____/(_) (_)`\___/'  |
|   | |                ( )_) |                                                |
|   (_)                 \___/'                                                |
|                                                                             |
| General Bots Copyright (c) Pragmatismo.io. All rights reserved.             |
| Licensed under the AGPL-3.0.                                                |
|                                                                             |
| According to our dual licensing model,this program can be used either      |
| under the terms of the GNU Affero General Public License,version 3,       |
| or under a proprietary license.                                             |
|                                                                             |
| The texts of the GNU Affero General Public License with an additional       |
| permission and of our proprietary license can be found at and               |
| in the LICENSE file you have received along with this program.              |
|                                                                             |
| This program is distributed in the hope that it will be useful,            |
| but WITHOUT ANY WARRANTY,without even the implied warranty of              |
| MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the                |
| GNU Affero General Public License for more details.                         |
|                                                                             |
| "General Bots" is a registered trademark of Pragmatismo.io.                 |
| The licensing of the program under the AGPLv3 does not imply a              |
| trademark license. Therefore any rights,title and interest in              |
| our trademarks remain entirely with us.                                     |
|                                                                             |
\*****************************************************************************/

'use strict';

/**
 * Image processing services of conversation to be called by BASIC.
 */
export class KeywordsExpressions {
  private static getParams = (text: string, names) => {
    let ret = {};
    const splitParamsButIgnoreCommasInDoublequotes = (str: string) => {
      return str.split(',').reduce(
        (accum, curr) => {
          if (accum.isConcatting) {
            accum.soFar[accum.soFar.length - 1] += ',' + curr;
          } else {
            accum.soFar.push(curr);
          }
          if (curr.split('"').length % 2 == 0) {
            accum.isConcatting = !accum.isConcatting;
          }
          return accum;
        },
        { soFar: [], isConcatting: false }
      ).soFar;
    };

    const items = splitParamsButIgnoreCommasInDoublequotes(text);

    let i = 0;
    let json = '';
    names.forEach(name => {
      let value = items[i];
      i++;
      json = `${json} "${name}": ${value} ${names.length == i ? '' : ','}`;
    });
    json = `${json}`;

    return json;
  };

  /**
   * Returns the list of BASIC keyword and their JS match.
   */
  public static getKeywords() {
    // Keywords from General Bots BASIC.

    let keywords = [];
    let i = 0;

    const convertConditions = input => {
      var result = input.replace(/ +and +/gim, ' && ');
      result = result.replace(/ +or +/gim, ' || ');
      result = result.replace(/ +<> +/gim, ' !== ');
      result = result.replace(/ += +/gim, ' === ');
      return result;
    };

    keywords[i++] = [/^\s*REM.*/gim, ''];

    keywords[i++] = [/^\s*\'.*/gim, ''];

    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*SELECT\s*(.*)/gim,
      ($0, $1, $2) => {
        let tableName = /\s*FROM\s*(\w+)/.exec($2)[1];
        let sql = `SELECT ${$2}`.replace(tableName, '?');
        return `${$1} = await sys.executeSQL({pid: pid, data:${$1}, sql:"${sql}", tableName:"${tableName}"})\n`;
      }
    ];

    keywords[i++] = [/^\s*end if/gim, '}'];

    keywords[i++] = [
      /^\s*if +(.*?) +then/gim,
      (input, group1) => {
        var condition = convertConditions(group1);
        return 'if (' + condition + ') {';
      }
    ];

    // Based on https://github.com/uweg/vbscript-to-typescript.

    keywords[i++] = [/^\s*else(?!{)/gim, '}\nelse {'];

    keywords[i++] = [/^\s*select case +(.*)/gim, 'switch ($1) {'];

    keywords[i++] = [/^\s*end select/gim, '}'];

    keywords[i++] = [/^\s*end function/gim, '}'];

    keywords[i++] = [/^\s*function +(.*)\((.*)\)/gim, '$1 = ($2) => {\n'];

    keywords[i++] = [/^\s*for +(.*to.*)/gim, 'for ($1) {'];

    keywords[i++] = [/^\s*next *$/gim, '}'];

    keywords[i++] = [
      /^\s*do while +(.*)/gim,
      function (input, group1) {
        var condition = convertConditions(group1);
        return 'while (' + condition + ') {';
      }
    ];

    keywords[i++] = [/^\s*loop *$/gim, '}'];

    keywords[i++] = [
      /^\s*open\s*(.*)/gim,
      ($0, $1, $2) => {
        let sessionName;
        let kind = '';
        let pos;

        if (pos = $1.match(/\s*AS\s*\#/)) {
          kind = '"AS"';
        } else if (pos = $1.match(/\s*WITH\s*\#/)) {
          kind = '"WITH"';
        }

        if (pos) {
          let part = $1.substr($1.lastIndexOf(pos[0]));
          sessionName = `"${part.substr(part.indexOf('#') + 1)}"`;
          $1 = $1.substr(0, $1.lastIndexOf(pos[0]));
        }

        if (!$1.startsWith('"') && !$1.startsWith("'")) {
          $1 = `"${$1}"`;
        }
        const params = this.getParams($1, ['url', 'username', 'password']);

        return `page = await wa.getPage({pid: pid, sessionKind: ${kind}, sessionName: ${sessionName}, ${params}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(set hear on)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        return `hrOn = ${$3}`;
      }
    ];

    keywords[i++] = [
      /^\s*hear (\w+) as (\w+( \w+)*.xlsx)/gim,
      ($0, $1, $2) => {
        return `${$1} = await dk.getHear({pid: pid, kind:"sheet", arg: "${$2}"})`;
      }
    ];

    keywords[i++] = [
      /^\s*hear (\w+) as\s*login/gim,
      ($0, $1) => {
        return `${$1} = await dk.getHear({pid: pid, kind:"login"})`;
      }
    ];

    keywords[i++] = [
      /^\s*hear (\w+) as\s*email/gim,
      ($0, $1) => {
        return `${$1} = await dk.getHear({pid: pid, kind:"email"})`;
      }
    ];

    keywords[i++] = [
      /^\s*hear (\w+) as\s*integer/gim,
      ($0, $1) => {
        return `${$1} = await dk.getHear({pid: pid, kind:"integer"})`;
      }
    ];

    keywords[i++] = [
      /^\s*hear (\w+) as\s*file/gim,
      ($0, $1) => {
        return `${$1} = await dk.getHear({pid: pid, kind:"file"})`;
      }
    ];

    keywords[i++] = [
      /^\s*hear (\w+) as\s*boolean/gim,
      ($0, $1) => {
        return `${$1} = await dk.getHear({pid: pid, kind:"boolean"})`;
      }
    ];

    keywords[i++] = [
      /^\s*hear (\w+) as\s*name/gim,
      ($0, $1) => {
        return `${$1} = await dk.getHear({pid: pid, kind:"name"})`;
      }
    ];

    keywords[i++] = [
      /^\s*hear (\w+) as\s*date/gim,
      ($0, $1) => {
        return `${$1} = await dk.getHear({pid: pid, kind:"date"})`;
      }
    ];

    keywords[i++] = [
      /^\s*hear (\w+) as\s*hour/gim,
      ($0, $1) => {
        return `${$1} = await dk.getHear({pid: pid, kind:"hour"})`;
      }
    ];

    keywords[i++] = [
      /^\s*hear (\w+) as\s*phone/gim,
      ($0, $1) => {
        return `${$1} = await dk.getHear({pid: pid, kind:"phone"})`;
      }
    ];

    keywords[i++] = [
      /^\s*hear (\w+) as\s*money/gim,
      ($0, $1) => {
        return `${$1} = await dk.getHear({pid: pid, kind:"money")}`;
      }
    ];

    keywords[i++] = [
      /^\s*hear (\w+) as\s*language/gim,
      ($0, $1) => {
        return `${$1} = await dk.getHear({pid: pid, kind:"language")}`;
      }
    ];

    keywords[i++] = [
      /^\s*hear (\w+) as\s*zipcode/gim,
      ($0, $1) => {
        return `${$1} = await dk.getHear({pid: pid, kind:"zipcode")}`;
      }
    ];

    keywords[i++] = [
      /^\s*hear (\w+) as\s*(.*)/gim,
      ($0, $1, $2) => {
        return `${$1} = await dk.getHear({pid: pid, kind:"menu", args: [${$2}]})`;
      }
    ];

    keywords[i++] = [
      /^\s*(hear)\s*(\w+)/gim,
      ($0, $1, $2) => {
        return `${$2} = await dk.getHear({pid: pid})`;
      }
    ];

    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*find contact\s*(.*)/gim,
      ($0, $1, $2, $3) => {
        return `${$1} = await dk.fndContact({pid: pid, ${$2}})`;
      }
    ];

    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*find\s*(.*)\s*or talk\s*(.*)/gim,
      ($0, $1, $2, $3) => {
        return `${$1} = await sys.find({pid: pid, args:[${$2}])\n
        if (!${$1}) {
          await dk.talk ({pid: pid, ${$3}})\n;
          return -1;
        }
        `;
      }
    ];

    keywords[i++] = [
      /^\s*CALL\s*(.*)/gim,
      ($0, $1) => {
        return `await ${$1}`;
      }
    ];

    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*find\s*(.*)/gim,
      ($0, $1, $2, $3) => {
        return `
        ${$1} = await sys.find({pid: pid, args: [${$2}]})`;
      }
    ];

    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*create deal(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        const params = this.getParams($3, ['dealName', 'contact', 'company', 'amount']);

        return `${$1} = await dk.createDeal({pid: pid, ${params}})`;
      }
    ];

    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*active tasks/gim,
      ($0, $1) => {
        return `${$1} = await dk.getActiveTasks({pid: pid})`;
      }
    ];

    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*append\s*(.*)/gim,
      ($0, $1, $2, $3) => {
        return `${$1} = await sys.append({pid: pid, args:[${$2}]})`;
      }
    ];

    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*sort\s*(\w+)\s*by(.*)/gim,
      ($0, $1, $2, $3) => {
        return `${$1} = await sys.sortBy({pid: pid, array: ${$2}, memberName: "${$3}"})`;
      }
    ];

    keywords[i++] = [
      /^\s*see\s*text\s*of\s*(\w+)\s*as\s*(\w+)\s*/gim,
      ($0, $1, $2, $3) => {
        return `${$2} = await sys.seeText({pid: pid, url: ${$1})`;
      }
    ];

    keywords[i++] = [
      /^\s*see\s*caption\s*of\s*(\w+)\s*as(.*)/gim,
      ($0, $1, $2, $3) => {
        return `${$2} = await sys.seeCaption({pid: pid, url: ${$1})`;
      }
    ];

    keywords[i++] = [
      /^\s*(wait)\s*(\d+)/gim,
      ($0, $1, $2) => {
        return `await sys.wait({pid: pid, seconds:${$2}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(get stock for )(.*)/gim,
      ($0, $1, $2) => {
        return `stock = await sys.getStock({pid: pid, symbol: ${$2})`;
      }
    ];

    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*get\s*(.*)/gim,
      ($0, $1, $2, $3) => {
        const count = ($2.match(/\,/g) || []).length;
        const values = $2.split(',');

        // Handles GET "selector".

        if (count == 1) {
          return `${$1} =  await wa.getBySelector({pid: pid, handle:page, selector: ${values[0]}})`;
        }

        // Handles GET "frameSelector", "selector"
        else if (count == 2) {
          return `${$1} =  await wa.getByFrame({pid: pid, handle: page, ${values[0]}, frameOrSelector: ${values[1]}, selector: ${values[2]}})`;
        }

        // Handles the GET http version.
        else {
          return `${$1} = await sys.get ({pid: pid, file: ${$2}, addressOrHeaders: headers, httpUsername, httpPs})`;
        }
      }
    ];

    keywords[i++] = [
      /\= NEW OBJECT/gim,
      ($0, $1, $2, $3) => {
        return ` = {pid: pid}`;
      }
    ];

    keywords[i++] = [
      /\= NEW ARRAY/gim,
      ($0, $1, $2, $3) => {
        return ` = []`;
      }
    ];

    keywords[i++] = [
      /^\s*(go to)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        const params = this.getParams($3, ['fromOrDialogName', 'dialogName']);
        return `await dk.gotoDialog({pid: pid, ${params}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(set language)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        return `await dk.setLanguage ({pid: pid, ${$3}})`;
      }
    ];

    keywords[i++] = [
      /^\s*set param \s*(.*)\s*as\s*(.*)/gim,
      ($0, $1, $2) => {
        return `await dk.setUserParam ({pid: pid, ${$1}}, ${$2})`;
      }
    ];

    keywords[i++] = [
      /^\s*get param \s*(.*)/gim,
      ($0, $1, $2) => {
        return `await dk.getUserParam ({pid: pid, ${$1}})`;
      }
    ];

    keywords[i++] = [
      /^\s*set header\s*(.*)\s*as\s*(.*)/gim,
      ($0, $1, $2) => {
        return `headers[${$1}]=${$2})`;
      }
    ];

    keywords[i++] = [
      /^\s*set http username\s*\=\s*(.*)/gim,
      ($0, $1) => {
        return `httpUsername = ${$1}`;
      }
    ];

    keywords[i++] = [
      /^\s*set http password\s*\=\s*(.*)/gim,
      ($0, $1) => {
        return `httpPs = ${$1}`;
      }
    ];

    keywords[i++] = [
      /^\s*(datediff)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        const params = this.getParams($3, ['date1', 'date2', 'mode']);
        return `await dk.dateDiff (pid: pid, ${params}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(dateadd)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        const params = this.getParams($3, ['date', 'mode', 'units']);
        return `await dk.dateAdd (pid: pid, ${$3})`;
      }
    ];

    keywords[i++] = [
      /^\s*(set max lines)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        return `await dk.setMaxLines ({pid: pid, count: ${$3}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(set max columns)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        return `await dk.setMaxColumns ({pid: pid, count: ${$3}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(set translator)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        return `await dk.setTranslatorOn ({pid: pid, on: "${$3.toLowerCase()}"})`;
      }
    ];

    keywords[i++] = [
      /^\s*(set theme)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        return `await dk.setTheme ({pid: pid, theme: "${$3.toLowerCase()}"})`;
      }
    ];

    keywords[i++] = [
      /^\s*(set whole word)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        return `await dk.setWholeWord ({pid: pid, on: "${$3.toLowerCase()}"})`;
      }
    ];

    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*post\s*(.*),\s*(.*)/gim,
      ($0, $1, $2, $3) => {
        return `${$1} = await sys.postByHttp ({pid: pid, url:${$2}, data:${$3}, headers})`;
      }
    ];

    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*put\s*(.*),\s*(.*)/gim,
      ($0, $1, $2, $3) => {
        return `${$1} = await sys.putByHttp ({pid: pid, url:${$2}, data:${$3}, headers})`;
      }
    ];

    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*download\s*(.*),\s*(.*)/gim,
      ($0, $1, $2, $3) => {
        return `${$1} = await sys.download ({pid: pid, handle:page, selector: ${$2}, folder:${$3}})`;
      }
    ];

    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*CREATE FOLDER\s*(.*)/gim,
      ($0, $1, $2) => {
        return `${$1} = await sys.createFolder ({pid: pid, name:${$2}})`;
      }
    ];

    keywords[i++] = [
      /^\s*SHARE FOLDER\s*(.*)/gim,
      ($0, $1) => {
        return `await sys.shareFolder ({pid: pid, name: ${$1}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(create a bot farm using)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        return `await sys.createABotFarmUsing ({pid: pid, ${$3}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(transfer to)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        return `await dk.transferTo ({pid: pid, to:${$3}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(\btransfer\b)(?=(?:[^"]|"[^"]*")*$)/gim,
      () => {
        return `await dk.transferTo ({pid: pid})`;
      }
    ];

    keywords[i++] = [
      /^\s*(exit)/gim,
      () => {
        return `return;`;
      }
    ];

    keywords[i++] = [
      /^\s*(END)/gim,
      () => {
        return `return;`;
      }
    ];

    keywords[i++] = [
      /^\s*(show menu)/gim,
      () => {
        return `await dk.showMenu ({pid: pid, })`;
      }
    ];

    keywords[i++] = [
      /^\s*(talk to)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        const params = this.getParams($3, ['mobile', 'message']);
        return `await sys.talkTo({pid: pid, ${params}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(talk)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        if ($3.substr(0, 1) !== '"') {
          $3 = `"${$3}"`;
        }
        return `await dk.getTalk ({pid: pid, text: ${$3}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(send sms to)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        const params = this.getParams($3, ['mobile', 'message']);
        return `await sys.sendSmsTo({pid: pid, ${params}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(send email)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        const params = this.getParams($3, ['to', 'subject', 'body']);
        return `await dk.sendEmail({pid: pid, ${params}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(send mail)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        const params = this.getParams($3, ['to', 'subject', 'body']);
        return `await dk.sendEmail({pid: pid, ${params}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(send file to)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        const params = this.getParams($3, ['mobile', 'filename', 'caption']);
        return `await dk.sendFileTo({pid: pid, ${params}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(hover)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        const params = this.getParams($3, ['handle', 'selector']);
        return `await wa.hover ({pid: pid, ${params}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(click link text)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        const params = this.getParams('page,' + $3, ['handle', 'text', 'index']);
        return `await wa.linkByText ({pid: pid, ${params}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(click)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        // page is not string.
        // https://github.com/GeneralBots/BotServer/issues/310
        const params = this.getParams('page,' + $3, ['handle', 'frameOrSelector', 'selector']);
        return `await wa.click ({pid: pid, ${params}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(send file)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        const params = this.getParams($3, ['filename', 'caption']);
        return `await dk.sendFile({pid: pid, ${params}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(copy)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        const params = this.getParams($3, ['src', 'dst']);
        return `await sys.copyFile ({pid: pid, ${params}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(convert)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        const params = this.getParams($3, ['src', 'dst']);
        return `await sys.convert ({pid: pid, ${params}})`;
      }
    ];

    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*chart(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        const params = this.getParams($3, ['type', 'data', 'legends', 'transpose']);
        return `${$1} = await dk.chart ({pid: pid, ${params}})`;
      }
    ];

    keywords[i++] = [
      /^\s*MERGE\s*(.*)\s*WITH\s*(.*)BY\s*(.*)/gim,
      ($0, $1, $2, $3) => {
        return `await sys.merge({pid: pid, file: ${$1}, data: ${$2}, key1: ${$3}})`;
      }
    ];

    keywords[i++] = [
      /^\s*(MERGE)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        return `await img.mergeImage({pid: pid, files: [${$3}]})`;
      }
    ];

    keywords[i++] = [
      /^\s*PRESS\s*(.*)/gim,
      ($0, $1, $2) => {
        return `await wa.pressKey({pid: pid, handle: page, char: ${$1}})`;
      }
    ];

    keywords[i++] = [
      /^\s*SCREENSHOT\s*(.*)/gim,
      ($0, $1, $2) => {
        return `await wa.screenshot({pid: pid, handle: page, selector: ${$1}})`;
      }
    ];

    keywords[i++] = [
      /^\s*TWEET\s*(.*)/gim,
      ($0, $1, $2) => {
        return `await sys.tweet({pid: pid, text: ${$1}})`;
      }
    ];

    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*(.*)\s*as\s*image/gim,
      ($0, $1, $2) => {
        return `${$1} = await sys.asImage({pid: pid, data: ${$2}})`;
      }
    ];

    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*(.*)\s*as\s*pdf/gim,
      ($0, $1, $2) => {
        return `${$1} = await sys.asPdf({pid: pid, data: ${$2})`;
      }
    ];

    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*FILL\s*(.*)\s*WITH\s*(.*)/gim,
      ($0, $1, $2, $3) => {
        return `${$1} = await sys.fill({pid: pid, templateName: ${$2}, data: ${$3}})`;
      }
    ];

    keywords[i++] = [
      /^\s*save\s*(.*)\s*as\s*(.*)/gim,
      ($0, $1, $2, $3) => {
        return `await sys.saveFile({pid: pid, file: ${$2}, data: ${$1}})`;
      }
    ];
    keywords[i++] = [
      /^\s*(save)(\s*)(.*)/gim,
      ($0, $1, $2, $3) => {
        return `await sys.save({pid: pid, args: [${$3}]})`;
      }
    ];

    keywords[i++] = [
      /^\s*set\s*(.*)/gim,
      ($0, $1, $2) => {
        const params = this.getParams($1, ['file', 'address', 'value']);
        return `await sys.set ({pid: pid, ${params}})`;
      }
    ];
    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*BLUR\s*(.*)/gim,
      ($0, $1, $2, $3) => {
        return `
        ${$1} = await img.blur({pid: pid, args: [${$2}]})`;
      }
    ];

    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*SHARPEN\s*(.*)/gim,
      ($0, $1, $2, $3) => {
        return `
        ${$1} = await img.sharpen({pid: pid, args: [${$2}]})`;
      }
    ];

    keywords[i++] = [
      /^\s*((?:[a-z]+.?)(?:(?:\w+).)(?:\w+)*)\s*=\s*CARD\s*(.*)/gim,
      ($0, $1, $2, $3) => {
        const params = this.getParams($1, ['doc', 'data']);
        return `
        ${$1} = await dk.card({pid: pid, args: [${$2}]})`;
      }
    ];

    return keywords;
  }
}
