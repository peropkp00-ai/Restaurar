#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs');
const path = require('path');
const ini = require('ini');
const readline = require('readline');

const CONFIG_FILE = 'config.ini';

// --- Helper Functions ---

function getConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        const configFile = fs.readFileSync(CONFIG_FILE, 'utf-8');
        return ini.parse(configFile);
    }
    return {};
}

function saveConfig(config) {
    fs.writeFileSync(CONFIG_FILE, ini.stringify(config));
}

function getSessionsDir() {
    const config = getConfig();
    const sessionsDir = config.sessions_directory;
    if (!sessionsDir || !fs.existsSync(sessionsDir)) {
        console.error('Error: Sessions directory not set or found. Please use the "dir" command first.');
        return null;
    }
    return sessionsDir;
}

function displaySession(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found at ${filePath}`);
        return;
    }

    try {
        const sessionData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (!sessionData.messages || !Array.isArray(sessionData.messages)) {
            console.error('Error: Invalid session file format. "messages" array not found.');
            return;
        }

        console.log(`\n--- Session Start: ${path.basename(filePath)} ---`);

        sessionData.messages.forEach(message => {
            const date = new Date(message.timestamp).toLocaleString();
            console.log(`\n==================================================`);
            console.log(`[${message.type.toUpperCase()}] - ${date}`);
            console.log(`--------------------------------------------------`);
            console.log(message.content);

            if (message.toolCalls && message.toolCalls.length > 0) {
                console.log(`\n--- Tool Calls ---`);
                message.toolCalls.forEach(toolCall => {
                    console.log(`  Name: ${toolCall.name}`);
                    console.log(`  Args: ${JSON.stringify(toolCall.args, null, 2).split('\n').map(l => '  ' + l).join('\n')}`);
                     if (toolCall.result) {
                        // Attempt to parse the result if it's a JSON string
                        try {
                            const resultObj = JSON.parse(toolCall.result);
                            console.log(`  Result: ${JSON.stringify(resultObj, null, 2).split('\n').map(l => '  ' + l).join('\n')}`);
                        } catch (e) {
                             console.log(`  Result: ${toolCall.result}`);
                        }
                    }
                    console.log(`  ----------------`);
                });
            }
        });

        console.log(`\n--- Session End ---`);

    } catch (error) {
        console.error(`Error processing session file: ${error.message}`);
    }
}


// --- Command Definitions ---

yargs(hideBin(process.argv))
    .command('dir <directory>', 'Set the sessions directory', (yargs) => {
        return yargs.positional('directory', {
            describe: 'Path to the directory containing session files',
            type: 'string'
        });
    }, (argv) => {
        if (fs.existsSync(argv.directory) && fs.lstatSync(argv.directory).isDirectory()) {
            const config = getConfig();
            config.sessions_directory = argv.directory;
            saveConfig(config);
            console.log(`Session directory set to: ${argv.directory}`);
        } else {
            console.error('Error: The specified path is not a valid directory.');
        }
    })
    .command('list', 'List all sessions in chronological order', () => {}, (argv) => {
        const sessionsDir = getSessionsDir();
        if (!sessionsDir) return;

        const files = fs.readdirSync(sessionsDir)
            .filter(file => file.endsWith('.json'))
            .sort();

        if (files.length === 0) {
            console.log('No sessions found in the directory.');
            return;
        }

        console.log('Available sessions:');
        files.forEach(file => {
            console.log(`- ${file}`);
        });
    })
    .command('load <filename>', 'Load and display a session', (yargs) => {
         return yargs.positional('filename', { describe: 'The name of the session file to load', type: 'string'});
    }, (argv) => {
        const sessionsDir = getSessionsDir();
        if (!sessionsDir) return;
        const filePath = path.join(sessionsDir, argv.filename);
        displaySession(filePath);
    })
    .command('chat-save', 'Interactively save a new chat session', () => {}, async (argv) => {
        const sessionsDir = getSessionsDir();
        if (!sessionsDir) return;

        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const messages = [];
        let currentType = 'user';

        function askQuestion() {
            rl.question(`Enter content for [${currentType.toUpperCase()}] (or type DONE to finish):\n`, (content) => {
                if (content.toUpperCase() === 'DONE') {
                    rl.close();
                    return;
                }

                messages.push({
                    id: `chat-save-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    type: currentType,
                    content: content
                });

                currentType = (currentType === 'user') ? 'gemini' : 'user';
                askQuestion();
            });
        }

        askQuestion();

        rl.on('close', () => {
             if (messages.length > 0) {
                const session = {
                    sessionId: `chat-save-session-${Date.now()}`,
                    startTime: messages[0].timestamp,
                    lastUpdated: messages[messages.length - 1].timestamp,
                    messages: messages
                };
                const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
                const filename = `session-${timestamp}-chatsave.json`;
                const filePath = path.join(sessionsDir, filename);

                fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
                console.log(`\nSession saved successfully to: ${filename}`);
            } else {
                console.log('\nNo messages were entered. Save operation cancelled.');
            }
        });
    })
    .command('chat-load <filename>', 'Load a saved chat session', (yargs) => {
        return yargs.positional('filename', { describe: 'The name of the chat file to load', type: 'string'});
    }, (argv) => {
        const sessionsDir = getSessionsDir();
        if (!sessionsDir) return;
        const filePath = path.join(sessionsDir, argv.filename);
        displaySession(filePath);
    })
    .demandCommand(1, 'You need to provide a command.')
    .help()
    .argv;
