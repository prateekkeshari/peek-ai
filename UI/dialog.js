const { ipcRenderer } = require('electron');

document.getElementById('input-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const url = document.getElementById('url').value.trim();
  if (url === '') { // check if the input field is empty
    alert('Please enter a URL');
  } else if (!isValidURL(url)) { // check if the URL is valid
    alert('Please enter a valid URL');
  } else {
    ipcRenderer.send('submit-input', url);
  }
});

function isValidURL(string) {
  const res = string.match(/(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/);
  return (res !== null);
};