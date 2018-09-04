# chrono-cli

__Note: This utility is for _Altoros_ internal use only__

This command line utility allows you to view and fill your weekly timesheet.

## How it works
The script runs a Chromium instance in headless mode and simulates a user interacting with the web page.

During the first run, it will ask for credentials and store the session data in the browser. Subsequent runs will use the same session (if profile is not deleted). Profile is stored in `./profile` 

After the initial load, it parses your projects/tasks and shows a table with the current weekly hours.

If less than 8 hours have been entered for the current day, it keeps prompting the user for a specific task and hours.

At the end, the user can save or send the sheet for approve.

Ctrl+C/Cmd+C cancels the current operation.

## Requirements
- Node.js

## Installation

- Clone repo
- `cd chrono-cli`
- `npm i && npm link`

## Usage
Run `chrono-cli` and follow the instructions.

## Contributing
File an issue :)
