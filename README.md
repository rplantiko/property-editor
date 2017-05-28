# property-editor
A tool to compare and edit multiple `.properties` files at once, particularly useful when they are used in internationalization as text ressources.
## Usage
Use it with [node webkit (nwjs)](https://nwjs.io/) by creating a folder `property-editor`, containing one single file `package.json`with the following content:
```
{  
  "name": "propcmp",  
  "main": "http://ruediger-plantiko.net/property-editor/?edit",
  "node-remote": "http://ruediger-plantiko.net",
  "window": {
    "width":1800,
    "height":1200
  }
}
```
With this package descriptor, the app is instructed to get all its ressources from the specified URL. 
Then start the app your favorite way, e.g. by dragging the folder to the nwjs executable.
## Documentation
The usage of the app should be self-explanatory. However, I use it in a [blogpost](http://ruediger-plantiko.blogspot.ch/2017/05/anwendungen-mit-html-ui.html) to talk about some aspects of HTML UI development (written in German).  
