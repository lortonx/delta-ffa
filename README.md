[![shield to Agar.io Private Servers guild](https://discordapp.com/api/guilds/407210435721560065/embed.png?style=shield)](https://discord.gg/XcKgShT)

https://dev.to/azure/passing-structured-data-from-c-to-javascript-in-web-assembly-1i0p
# OgarII

Your friendly agar.io private server recreation.

- It supports all current agar.io protocol versions.

- It supports handling multiple worlds, all within one instance. Be wary that you can still use up the one CPU core node.js is running on.

- It has a minimal memory footprint, and strictly uses uWebSockets for networking.

- The code uses JSDoc to specify types. Understanding what the code does is down to your understanding of English.

## Notes

- Ask all your questions over on the [Agar.io Private Servers](https://discord.gg/66X2ESb) Discord guild.

- Before connecting from agar.io you will need to do `core.disableIntegrityChecks(true)` in the console.

## Running

1. Make sure you have node.js version 8 or greater.

2. Make sure you have a C++11 compliant compiler for building uWebSockets.
    - If you're on Windows, `npm install -g windows-build-tools`.
    - If you're on GNU/Linux, use your package manager to install a supported C++ compiler such as GCC.

3. Clone / [download](https://github.com/Luka967/OgarII/archive/master.zip) the repo.

4. `npm install` in `/`.

5. `cd ./cli/`

6. `node index.js`

## Configuring

- After your first run, OgarII will drop two files in `cli/` / working directory: `log-settings.json` and `settings.json`.

- To change how OgarII runs, modify `cli/settings.json`.

- To change what gets logged, modify `cli/log-settings.json`.

## Expanding

- To create your own commands, check out `src/commands/CommandList.js` on the command API. To add it to the CLI use `ServerHandle.commands.register`, and for chat commands use `ServerHandle.chatCommands.register`.

- To create your own gamemodes, inherit `src/Gamemode.js`'s `Gamemode` abstract class, modify event handling to your wish, then add it with `ServerHandle.gamemodes.register` before the handle starts.

- The `ServerHandle` class is standalone, which means that you can completely ditch the `cli/` folder, `require("./src/ServerHandle.js")` and do whatever you want with it. OgarII is also available as an npm package for this exact purpose.

https://stackoverflow.com/questions/41946007/efficient-and-well-explained-implementation-of-a-quadtree-for-2d-collision-det
https://github.com/elliotdelano/dev-lib/blob/6bf06668060258ad19f6ff147ae309260683b671/core.js#L347
https://github.com/gerazo/loose_quadtree/tree/master/src/include
https://github.com/Appleguysnake/DragonSpace-Demo/blob/master/Assets/Scripts/DragonSpace/Quadtrees/LooseQuadtreeT.cs
https://github.com/CAntol/Loose-Quadtree/blob/6548a634e2fda3379c27a6e9c337e065b221212e/loosequadtree.c

https://github.com/sirisacademic/jassa-core-es6/blob/6fd56c081e52fe5fbdbc47be82fc18224690acab/src/geo/QuadTree.js
https://github.com/GeoKnow/Jassa/blob/5617360466d74148d76808352936d1d47d4c4f14/jassa-js/src/main/webapp/resources/js/geo/quad-tree.js