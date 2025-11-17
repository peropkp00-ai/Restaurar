#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const configDir = path.join(os.homedir(), '.gemini-sesiones');
const configFile = path.join(configDir, 'config.json');

async function getSessionDir() {
  try {
    const configData = await fs.readFile(configFile, 'utf-8');
    const config = JSON.parse(configData);
    return config.sessionDir;
  } catch (error) {
    return undefined;
  }
}

async function setSessionDir(dir) {
  try {
    await fs.mkdir(configDir, { recursive: true });
    const config = { sessionDir: dir };
    await fs.writeFile(configFile, JSON.stringify(config, null, 2));
    console.log(`Directorio de sesiones guardado en: ${dir}`);
  } catch (error) {
    console.error(`Error al guardar el directorio de sesiones: ${error}`);
  }
}

async function listSessions() {
  const sessionDir = await getSessionDir();
  if (!sessionDir) {
    console.error('El directorio de sesiones no está configurado. Usa "dir <path>" para configurarlo.');
    return;
  }

  try {
    const files = await fs.readdir(sessionDir);
    const sessionFiles = files.filter((file) => file.endsWith('.json'));

    const fileStats = await Promise.all(
      sessionFiles.map(async (file) => {
        const filePath = path.join(sessionDir, file);
        const stats = await fs.stat(filePath);
        return { file, mtime: stats.mtime };
      })
    );

    fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

    console.log('Sesiones:');
    for (const { file, mtime } of fileStats) {
      console.log(`- ${file} (${mtime.toLocaleString()})`);
    }
  } catch (error) {
    console.error(`Error al listar las sesiones: ${error}`);
  }
}

async function loadSession(filename) {
  const sessionDir = await getSessionDir();
  if (!sessionDir) {
    console.error('El directorio de sesiones no está configurado. Usa "dir <path>" para configurarlo.');
    return;
  }

  const filePath = path.join(sessionDir, filename);

  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const sessionData = JSON.parse(fileContent);

    if (sessionData.conversation && sessionData.conversation.turns) {
      console.log(`Sesión: ${filename}`);
      console.log('-----------------------------------');
      for (const turn of sessionData.conversation.turns) {
        const timestamp = new Date(turn.timestamp).toLocaleString();
        console.log(`[${timestamp}] ${turn.role}:`);
        for (const part of turn.parts) {
          console.log(part.text);
        }
        console.log('-----------------------------------');
      }
    } else {
      console.error('Formato de archivo de sesión inválido.');
    }
  } catch (error) {
    console.error(`Error al cargar la sesión: ${error}`);
  }
}

async function chatSave() {
  const sessionDir = await getSessionDir();
  if (!sessionDir) {
    console.error('El directorio de sesiones no está configurado. Usa "dir <path>" para configurarlo.');
    return;
  }

  // Placeholder for the actual chat history
  const chatHistory = {
    conversation: {
      turns: [
        {
          timestamp: new Date().toISOString(),
          role: 'user',
          parts: [{ text: 'Hello!' }],
        },
        {
          timestamp: new Date().toISOString(),
          role: 'model',
          parts: [{ text: 'Hi there!' }],
        },
      ],
    },
  };

  const now = new Date();
  const filename = `${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}_${now
    .getHours()
    .toString()
    .padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}-${now
    .getSeconds()
    .toString()
    .padStart(2, '0')}.json`;
  const filePath = path.join(sessionDir, filename);

  try {
    await fs.writeFile(filePath, JSON.stringify(chatHistory, null, 2));
    console.log(`Sesión guardada en ${filename}`);
  } catch (error) {
    console.error(`Error al guardar la sesión: ${error}`);
  }
}

yargs(hideBin(process.argv))
  .command('list', 'List all sessions', listSessions)
  .command('load <filename>', 'Load a session', (yargs) => {
    return yargs.positional('filename', {
      describe: 'The name of the session file to load',
      type: 'string',
    });
  }, (argv) => {
    loadSession(argv.filename);
  })
  .command('dir <path>', 'Set the session directory', (yargs) => {
    return yargs.positional('path', {
      describe: 'Path to the session directory',
      type: 'string',
    });
  }, (argv) => {
    setSessionDir(argv.path);
  })
  .command('chat-save', 'Save the current session', chatSave)
  .command('chat-load <filename>', 'Load a chat session', (yargs) => {
    return yargs.positional('filename', {
      describe: 'The name of the session file to load',
      type: 'string',
    });
  }, (argv) => {
    console.log(`Loading chat session: ${argv.filename}`);
  })
  .demandCommand(1, 'You need to provide a command.')
  .help()
  .argv;
