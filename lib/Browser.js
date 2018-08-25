const path = require('path');
const puppeteer = require('puppeteer');

const CHROME_EXEC_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHROME_USER_DATA_DIR = '/Users/demian/Library/Application Support/Google/Chrome';

class Browser {

  constructor() {
    this.browser = null;
    this.page = null;
    this.data = null;
    this.pendingChanges = false;
    this.debug = process.env.NODE_ENV === 'development';
  }

  async open() {
    console.log('Loading Chrono...');

    this.browser = await puppeteer.launch({
      userDataDir: path.resolve(__dirname, '../profile'),
      headless: !this.debug,
      devtools: this.debug,
    });
    this.page = await this.browser.newPage();
    this.page.setDefaultNavigationTimeout(10000);
    await this.page.goto('https://chrono.altoros.com/');
  }

  async needsLogin() {
    const loginButton = await this.page.$('#LoginControl_Login');
    return !!loginButton;
  }

  async login(user, pass) {
    console.log('Logging in...');
    const { page } = this;

    await page.type('#LoginControl_UserName', user);
    await page.type('#LoginControl_Password', pass);
    await page.click('#LoginControl_RememberMe');
    await page.click('#LoginControl_Login');
    await page.waitForSelector('.timeSheetBlock');
  }

  async load() {
    console.log('Loading tasks...');
    const { page } = this;

    return new Promise(async (resolve, reject) => {
      try {
        const projectCount = await page.$$eval('.toggler_expand', async (elements) => {
          return elements.map(item => item.click()).length;
        });
        let loadedProjects = 0;
        const handleResponse = async (response) => {
          loadedProjects++;
          if (loadedProjects === projectCount) {
            try {
              // let's wait for dom to be ready
              await page.waitFor(1000);
              const projects = await this.parseData();
              resolve(projects);
            } catch (e) {
              reject(e);
            }
            page.removeListener('response', handleResponse);
          }
        };
        page.on('response', handleResponse);
      } catch (e) {
        reject(e);
      }
    });
  }

  async parseData() {
    const { page } = this;

    const currentDate = new Date().getDate();

    const cols = await page.$$eval(`.persist-area thead th.day`, async (elements) => {
      const names = elements.map(item => item.textContent.trim().replace(/\s+/g, ' '));
      const dates = elements.map(item => Number(item.querySelector('span').textContent.trim()));
      return { names, dates };
    });

    const dayColumnIndex = cols.dates.findIndex(date => date === currentDate);

    const projects = await page.$$eval('.persist-area .level_1', async (elements, dayColumnIndex) => {
      return elements.map((projectNode) => {
        const id = projectNode.id;
        const name = projectNode.querySelector('.name').textContent.trim().replace(/^\d+_/, '').replace(/_/g, ' ');
        const tasks = Array.from(projectNode.parentNode.querySelectorAll(`tr[parentid="${id}"]`))
          .map((taskNode) => {
            const inputs = Array.from(taskNode.querySelectorAll('.day.arrow input[type="text"]:not([disabled])'));
            return {
              id: taskNode.id,
              name: taskNode.querySelector('.taskTitle').textContent.trim(),
              dayHours: Number(inputs[dayColumnIndex].value),
            };
          });
        const dayHours = tasks.reduce((count, task) => count + task.dayHours, 0);
        const weekHours = Array.from(projectNode.querySelectorAll('.day[columnid]'))
          .map(item => Number(item.textContent.trim()));

        return { id, name, tasks, dayHours, weekHours };
      });
    }, dayColumnIndex);

    const totalDayHours = projects.reduce((count, project) => count + project.dayHours, 0);

    const weekTotals = await page.$$eval('#total td:not(:empty)', async (elements) => elements.map(item => item.textContent.trim() || '0'));

    const summary = [['Project'].concat(cols.names).concat(['TOTAL'])]
      .concat(projects.map(project => [project.name].concat(project.weekHours)))
      .concat([weekTotals]);

    this.data = { currentDate, dayColumnIndex, totalDayHours, summary, projects };

    return this.data;
  }

  async fill(taskId, dayColumnIndex, hours) {
    const inputElement = await this.page.$(`tr[id="${taskId}"] .day.arrow[columnid="${dayColumnIndex + 1}"] input[type="text"]:not([disabled])`);
    await inputElement.press('ArrowRight');
    await inputElement.press('Backspace');
    await inputElement.type(String(hours));
    this.pendingChanges = true;
  }

  async save() {
    if (!this.pendingChanges) {
      console.log('Nothing to save...');
      return;
    }
    console.log('Saving...');
    await this.page.click('a.update');
    await this.page.waitForResponse(response => response.ok());
  }

  async submit() {
    console.log('Submitting...');
    // await this.page.click('a.send_for_approve');
    // await this.page.waitForResponse(response => response.ok());
  }

  async close() {
    console.log('Closing...');
    try {
      await this.page.close();
      await this.browser.close();
    } catch (e) {
      console.error('browser already closed');
    }
  }
}

module.exports = Browser;
