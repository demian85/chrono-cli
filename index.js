#!/usr/local/bin/node

const inquirer = require('inquirer');
const { table } = require('table');
const Browser = require('./lib/Browser');

let browser;

async function handleExit() {
  if (browser) {
    await browser.close();
  }
  process.exit();
}

function buildPrompt(projects) {
  return [
    {
      type: 'list',
      name: 'projectId',
      message: 'Select a project',
      choices: projects.map(item => ({ name: item.name, value: item.id })),
    },
    {
      type: 'list',
      name: 'taskId',
      message: 'Select task',
      choices: (prev) => {
        return projects
          .find(item => item.id === prev.projectId).tasks
          .map(item => ({ name: item.name, value: item.id }))
      }
    },
    {
      type: 'input',
      name: 'hours',
      message: 'Enter hours',
      filter: input => Number(input),
      validate: input => !isNaN(input),
    },
  ];
}

async function init() {
  browser = new Browser();

  console.log(`📅 ${new Date().toDateString()}`);

  await browser.open();

  if (await browser.needsLogin()) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'user',
        message: 'Username:',
        prefix: '👤',
      },
      {
        type: 'password',
        name: 'pass',
        message: 'Password:',
        prefix: '🔑',
      }
    ]);
    const { user, pass } = answers;
    await browser.login(user, pass);
  }

  const { projects, totalDayHours, dayColumnIndex, summary } = await browser.load();
  let dayHours = totalDayHours;

  console.log(table(summary, {
    columnDefault: {
      alignment: 'center'
    },
    columns: {
      0: { alignment: 'left' }
    }
  }));
  console.log(`💻 ${projects.length} projects found`);
  console.log(`🕑 ${dayHours} hours have been entered for today`);

  while (dayHours < 8) {
    const { taskId, hours } = await inquirer.prompt(buildPrompt(projects));
    dayHours += hours;

    console.log(`Total day hours: ${dayHours}`);

    await browser.fill(taskId, dayColumnIndex, hours);
  }

  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Submit for approve?',
      default: false,
    }
  ]);

  if (answers.confirm) {
    await browser.submit();
  } else {
    await browser.save();
  }

  console.log('👌 Very nice!');

  await browser.close();
}

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);

(async () => {
  try {
    await init();
  } catch (e) {
    console.error('Unexpected error: ', e);
  }
})();
