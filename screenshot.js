const { clipboard, nativeImage, dialog } = require('electron');
const fs = require('fs');
const Jimp = require('jimp');
let mainWindow;
let icon;

function processImage(image, callback) {
    const dimensions = image.getSize();
    const padding = 65; // adjust this to change the size of the border
    const outerWidth = dimensions.width + 2 * padding;
    const outerHeight = dimensions.height + 2 * padding;
  
    // Create a new image with the desired background color
    new Jimp(outerWidth, outerHeight, '#E76256', (err, background) => {
      if (err) {
        console.error("Error creating background:", err);
        return;
      }
  
      // Read the image from the buffer
      Jimp.read(image.toPNG(), (err, img) => {
        if (err) {
          console.error("Error reading image:", err);
          return;
        }
  
        // Resize the image
        img.resize(dimensions.width, dimensions.height);
  
        // Composite the image over the background
        background.composite(img, padding, padding);
  
        // Get the buffer of the final image
        background.getBuffer(Jimp.MIME_PNG, (err, finalImageBuffer) => {
          if (err) {
            console.error("Error getting image buffer:", err);
            return;
          }
  
          callback(finalImageBuffer);
        });
      });
    });
  }
  async function captureAndProcessImage() {
    try {
      const image = await mainWindow.webContents.capturePage();
      const finalImageBuffer = await new Promise((resolve, reject) => {
        processImage(image, resolve);
      });
      return finalImageBuffer;
    } catch (err) {
      console.error("Error capturing page:", err);
    }
  }
  
  async function screenshotToClipboard() {
    try {
      const finalImageBuffer = await captureAndProcessImage();
      if (finalImageBuffer) {
        clipboard.writeImage(nativeImage.createFromBuffer(finalImageBuffer));
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
      } else {
        console.error("Failed to capture and process image");
      }
    } catch (err) {
      console.error("Error copying to clipboard:", err);
    }
  }
  function saveScreenshot() {
    mainWindow.webContents.capturePage().then(image => {
      processImage(image, finalImageBuffer => {
        dialog.showSaveDialog(mainWindow, {
          title: 'Save screenshot',
          defaultPath: 'screenshot.png',
          filters: [{ name: 'Images', extensions: ['png'] }]
        }).then(result => {
          if (!result.canceled) {
            fs.writeFile(result.filePath, finalImageBuffer, err => {
              if (err) console.error("Error saving file:", err);
              else console.log('Screenshot saved.');
            });
          }
        }).catch(err => console.error("Error in save dialog:", err));
      });
    }).catch(err => console.error("Error capturing page:", err));
  }

module.exports = {
  processImage,
  captureAndProcessImage,
  screenshotToClipboard,
  saveScreenshot,
  setMainWindow: (window) => { mainWindow = window; },
  setIcon: (iconPath) => { icon = iconPath; }
};