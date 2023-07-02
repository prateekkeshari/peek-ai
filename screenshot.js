const { dialog, clipboard, nativeImage } = require('electron');
const sharp = require('sharp');
const fs = require('fs');

function processImage(image, callback) {
    const dimensions = image.getSize();
    const padding = 65; // adjust this to change the size of the border
    const outerWidth = dimensions.width + 2 * padding;
    const outerHeight = dimensions.height + 2 * padding;
  
    // Create a new image with the background color
    const background = Buffer.from(
      `<svg width="${outerWidth}" height="${outerHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="Gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="10%" stop-color="#CE9FFC"/>
            <stop offset="100%" stop-color="#7367F0"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${outerWidth}" height="${outerHeight}" fill="url(#Gradient1)"/>
      </svg>`
    );
  
    // Create a mask for rounding the corners of the screenshot
    const mask = Buffer.from(
      `<svg><rect x="0" y="0" width="${dimensions.width}" height="${dimensions.height}" rx="15" ry="15"/></svg>`
    );
  
    // Create a mask for rounding the corners of the border
    const borderMask = Buffer.from(
      `<svg><rect x="0" y="0" width="${outerWidth}" height="${outerHeight}" rx="12" ry="12"/></svg>`
    );
  
    // After saving the screenshot, round the corners and composite it on the background
    sharp(image.toPNG())
      .flatten({ background: { r: 255, g: 255, b: 255 } }) // replace transparency with white
      .composite([{
        input: mask,
        blend: 'dest-in'
      }])
      .toBuffer()
      .then(roundedImageBuffer => {
        sharp(background)
          .composite([{
            input: borderMask,
            blend: 'dest-in'
          }, {
            input: roundedImageBuffer,
            top: padding,
            left: padding,
            blend: 'over'
          }])
          .toBuffer()
          .then(finalImageBuffer => {
            callback(finalImageBuffer);
          });
      });
  }
  
  function screenshotToClipboard() {
    // When the user presses Command+S, capture a screenshot of the webview
    mainWindow.webContents.capturePage().then(image => {
      processImage(image, finalImageBuffer => {
        // Copy the image to the clipboard
        clipboard.writeImage(nativeImage.createFromBuffer(finalImageBuffer));
        // Show a dialog box to confirm that the image has been copied
        const detail = [
          'The question is: where do you paste it?',
          'I think the screenshot looks beautiful!',
          'That is a master shot!',
          'Totally worth capturing. Paste it away!',
          'Now, where will this masterpiece end up?',
          'A moment frozen in time, ready to be pasted!',
          'Your screenshot is ready for its debut. Paste it!',
          'That\'s one for the scrapbook!',
          'A picture is worth a thousand words, and this one\'s on your clipboard!',
          'Your screenshot is ready to make its mark!',
          'That\'s a screenshot worth sharing!',
          'Your screenshot is ready to see the world!',
          'A moment captured, ready to be pasted!',
          'Your screenshot is ready for the spotlight!',
          'Your screenshot is ready to be pasted into fame!'
        ];    
        const randomDetail=detail[Math.floor(Math.random() * detail.length)];
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Peek',
          message: 'Screenshot copied to clipboard!',
          detail: randomDetail,
          buttons: ['OK'],
          icon: icon
        });
        console.log('Clipboard saved.');
      });
    });
  }
  
  function saveScreenshot() {
    // When the user presses Command+S, capture a screenshot of the webview
    mainWindow.webContents.capturePage().then(image => {
      processImage(image, finalImageBuffer => {
        // Save the image
        dialog.showSaveDialog(mainWindow, {
          title: 'Save screenshot',
          defaultPath: 'screenshot.png',
          filters: [{ name: 'Images', extensions: ['png'] }]
        }).then(result => {
          if (!result.canceled) {
            fs.writeFile(result.filePath, finalImageBuffer, err => {
              if (err) throw err;
              console.log('Screenshot saved.');
            });
          }
        }).catch(err => {
          console.log(err);
        });
      });
    });
  }

module.exports = { screenshotToClipboard, saveScreenshot };
