import * as fs from "fs";
import DefaultSettings from "../src/Settings";
import ServerHandle from "../src/ServerHandle";
import {genCommand} from "../src/commands/CommandList";
import * as readline from 'readline';

import DefaultCommands from "../src/commands/DefaultCommands";

import LegacyProtocol from "../src/protocols/LegacyProtocol";
import ModernProtocol from "../src/protocols/ModernProtocol";
import DeltaProtocol from "../src/protocols/DeltaProtocol";
const DefaultProtocols = [
    LegacyProtocol,
    ModernProtocol,
    DeltaProtocol,
];
import FFA from "../src/gamemodes/FFA";
import Teams from "../src/gamemodes/Teams";
import LastManStanding from "../src/gamemodes/LastManStanding";
const DefaultGamemodes = [
    FFA,
    Teams,
    LastManStanding
];

/** @returns {DefaultSettings} */
function readSettings() {
    try { return JSON.parse(fs.readFileSync("./settings.json", "utf-8")); }
    catch (e) {
        console.log("caught error while parsing/reading settings.json:", e.stack);
        process.exit(1);
    }
}
/** @param {DefaultSettings} settings */
function overwriteSettings(settings) {
    fs.writeFileSync("./settings.json", JSON.stringify(settings, null, 4), "utf-8");
}

if (!fs.existsSync("./settings.json"))
    overwriteSettings(DefaultSettings);
let settings = readSettings();

const currentHandle = new ServerHandle(settings);
overwriteSettings(currentHandle.settings);

import logHandler from "./log-handler"
logHandler(currentHandle)

const logger = currentHandle.logger;

let commandStreamClosing = false;
const commandStream = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    prompt: "",
    historySize: 64,
    removeHistoryDuplicates: true
});
commandStream.once("SIGINT", () => {
    logger.inform("command stream caught SIGINT");
    commandStreamClosing = true;
    commandStream.close();
    currentHandle.stop();
    process.exitCode = 0;
});


DefaultCommands(currentHandle.commands, currentHandle.chatCommands);
currentHandle.protocols.register(...DefaultProtocols);
currentHandle.gamemodes.register(...DefaultGamemodes);
currentHandle.commands.register(
    genCommand({
        name: "start",
        args: "",
        desc: "start the handle",
        /**
         * @param {ServerHandle} context
         */
        exec: (handle, context, args) => {
            if (!handle.start()) handle.logger.print("handle already running");
        }
    }),
    genCommand({
        name: "stop",
        args: "",
        desc: "stop the handle",
        /**
         * @param {ServerHandle} context
         */
        exec: (handle, context, args) => {
            if (!handle.stop()) handle.logger.print("handle not started");
        }
    }),
    genCommand({
        name: "exit",
        args: "",
        desc: "stop the handle and close the command stream",
        /**
         * @param {ServerHandle} context
         */
        exec: (handle, context, args) => {
            handle.stop();
            commandStream.close();
            commandStreamClosing = true;
        }
    }),
    genCommand({
        name: "reload",
        args: "",
        desc: "reload the settings from local settings.json",
        /**
         * @param {ServerHandle} context
         */
        exec: (handle, context, args) => {
            handle.setSettings(readSettings());
            logger.print("done");
        }
    }),
    genCommand({
        name: "save",
        args: "",
        desc: "save the current settings to settings.json",
        /**
         * @param {ServerHandle} context
         */
        exec: (handle, context, args) => {
            overwriteSettings(handle.settings);
            logger.print("done");
        }
    }),
);

function ask() {
    if (commandStreamClosing) return;
    commandStream.question("@ ", (input) => {
        setTimeout(ask, 0);
        if (!(input = input.trim())) return;
        logger.printFile(`@ ${input}`);
        if (!currentHandle.commands.execute(null, input))
            logger.print(`unknown command`);
    });
}
setTimeout(() => {
    logger.debug("command stream open");
    ask();
}, 1000);
currentHandle.start();

