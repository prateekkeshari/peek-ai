# Peek

A simple MacOS app that displays a web page in a borderless window that can be shown or hidden from the system tray. 

## Use cases
- Use it for chat.openai.com - a nice, always-on window without the need to use your OpenAI API key.
- Use it to quickly look up something on the internet
- Use it for testing web pages or web applications in a separate window without interfering with other browser windows.
- Display a dashboard or analytics page for easy monitoring of key metrics.
- Use it for research to keep multiple webpages open and easily accessible.

## Installation

1. Clone or download the repository.
2. Install dependencies by running `npm install`.
3. Start the app by running `npm start`.

## Usage

When the app is running, you can show or hide the window by clicking on the app icon in the system tray. The window will display a web page with a URL that 
you can enter in the text input field.

## Development

To modify the app, you can edit the files in the `UI` directory. The `index.html` file contains the HTML code for the app, the `styles.css` file contains the CSS code, and the `scripts.js` file contains the JavaScript code. The `preload.js` file contains code that runs in the app's renderer process and has access 
to Node.js APIs.

To run the app in development mode, run `npm run dev`. This will start the app with the DevTools window open for debugging.

## What's Coming Next
-  [ ] Implement resizable window functionality to allow users to adjust the size of the window to their liking.
-  [ ] Add a "frequently visited sites" feature to allow users to quickly access their most frequently visited websites.
-  [ ] Add a toggle for the address bar to allow users to hide or show the address bar as needed.

## License
This project is licensed under the [MIT License](LICENSE).