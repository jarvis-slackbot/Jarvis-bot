/*
    Handles parsing commands and command arguments
 */
/* Permissions from open-source

string-similarity
    https://www.npmjs.com/package/string-similarity
    link: https://spdx.org/licenses/ISC
ISC License:
Copyright (c) 2004-2010 by Internet Systems Consortium, Inc. ("ISC") 
Copyright (c) 1995-2003 by Internet Software Consortium

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND ISC DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL ISC BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

 */


'use strict';

const commandLineArgs = require('command-line-args');
//const stringSimilarity = require('string-similarity');

const commandList = require('./commands_list').commandList;
let columnify = require('columnify');

const DEFAULT_HELP_SPACING = 60;


// Parse command and get select appropriate function
// Param message is array of command line args (message[0] being command itself)
// Returns string or a promise that resolves a SlackTemplate
exports.parseCommand = function(message){
    var first = message[0].toString();
    var func;
    var cmd;
    message.splice(0,1); // remove command to get arguments

    if(isAWSCommand(first)){
        cmd = getAWSCommand(first);
        // If there are arguments, pass them along to function
        if(hasArguments(cmd)){
            try {
                var options = listEmpty(message) ? null
                    : commandLineArgs(cmd.Arguments, {argv: message});
                if(options && options.help){
                    func = helpForAWSCommand(first);
                }
                else{
                    func = cmd.Function(options);
                }
            } catch(err){
                // Must return a promise for proper message handling
                func = new Promise(function(resolve, reject){
                    if (err.name === "UNKNOWN_OPTION"){
                        var msg = require('./message.js').errorMessage(
                            "Argument error: " + err.name + 
                            "\nSuggestion: Please use the --help flag for a list of valid arguments."
                        );

                        //find and print most similar existing flag of user's passed flag for their AWS command
                        //obj.Arguments.name
                        /*
                        let cmd_flagNamesArray = [];
                        cmd.Arguments.forEach((flag)=>{
                            cmd_flagNamesArray.push(flag.name);
                        });
                        let bestFlagMatch = (stringSimilarity.findBestMatch('cmd.Name', cmd_flagNamesArray)).bestMatch.target;
                        msg += "\nDid you mean: --" + bestFlagMatch;
                        */
                        /*
                        { ratings:
                           [ { target: 'For sale: green Subaru Impreza, 210,000 miles',
                               rating: 0.3013698630136986 },
                             { target: 'For sale: table in very good condition, olive green in colour.',
                               rating: 0.7073170731707317 },
                             { target: 'Wanted: mountain bike with at least 21 gears.',
                               rating: 0.11267605633802817 } ],
                          bestMatch:
                           { target: 'For sale: table in very good condition, olive green in colour.',
                             rating: 0.7073170731707317 } 
                        }
                        */
                        
                        
                    }
                    else {
                        var msg = require('./message.js').errorMessage(
                            "Argument error: " + err.name
                        );
                    }
                    resolve(msg);
                });
            }

        }
        else{
            func = cmd.Function;
        }
    }
    // If it's a non aws command
    else if(isCommand(first)){
        func = isHelp(first) ? helpList() : getCommand(first).Function;
    }
    else{
        func = "Command parse error.";
    }

    return func;
};

exports.isCommand = function(message){
  return (isCommand(message) || isAWSCommand(message));
};

// Does this command has arguments?
function hasArguments(command){
    return !!(command.Arguments);
}


// If the command is the help command - Special case here
function isHelp(first){
    return commandList.commands[0].Name === first;
}

// Get normal command block
function getCommand(first){
    var res;
    commandList.commands.forEach((cmd)=>{
        if(cmd.Name === first){
            res = cmd;
        }
    });

    return res;
}

// Get AWS command block
function getAWSCommand(first){
    var res;
    commandList.AWSCommands.forEach((cmd)=>{
        if(cmd.Name === first){
            res = cmd;
        }
    });

    return res;
}
// Is a normal command
function isCommand(first){
    var res = false;
    commandList.commands.forEach((cmd)=>{
        if(cmd.Name === first){
            res = true;
        }
    });

    return res;
}

// If the command requires a fetch from AWS
function isAWSCommand(first){
    var res = false;
    commandList.AWSCommands.forEach((cmd)=>{
        if(cmd.Name === first){
            res = true;
        }
    });

    return res;
}

// Commands
function helpList(){
    var str = "";
    commandList.commands.forEach((cmd)=>{
        str += cmd.Name + "\t\t" + cmd.Description + "\n";
    });
    commandList.AWSCommands.forEach((awsCmd)=>{
        str += awsCmd.Name + "\t\t" + awsCmd.Description + "\n";
    });
    return "Here are my available commands:\n" + toCodeBlock(str);
}

// Turn string into slack codeblock
function toCodeBlock(str){
    // triple back ticks for code block
    var backticks = "```";
    return backticks + str + backticks;
}
// Turn to slack bold
function bold(str){
    return '*' + str + '*';
}

function italic(str){
    return '_' + str + '_';
}

// Return true for empty list
function listEmpty(list){
    return !(typeof list !== 'undefined' && list.length > 0);
}

function multiplyString(str, num){
    return new Array(num + 1).join(str);
}

// Generates help output for a given command
function helpForAWSCommand(command){
    let helpStr = '';
    let argsData = [];
    let commandBlock = getAWSCommand(command);

    // Build arguments section
    commandBlock.Arguments.forEach((arg) => {
        let argsLeftStr = '';
        let argsRightStr = '';
        if(arg.alias){
            argsLeftStr += '-' + arg.alias + ', ';
        }
        argsLeftStr += '--' + arg.name + ' ';
        // If there is a type
        if(arg.type !== Boolean && arg.TypeExample){
            argsLeftStr += ' ' + italic(arg.TypeExample);
            // Double the length is required here for some reason??
        }
        argsRightStr += arg.ArgumentDescription;
        argsData.push({
            Argument: argsLeftStr,
            Description: argsRightStr
        });
    });

    let argsStr = columnify(argsData,{
        minWidth: 60,
    });
    // Build title and description with args
    helpStr += '\n\n' +
        bold(commandBlock.Name) + "\n\n" +
            commandBlock.Description + "\n\n" +
            bold('Options') + '\n\n' +
            argsStr;

    return helpStr;
}