// The incipit of a tiny HTML DOM framework

ui = (function(){

  "use strict";
  
// ----------------------------------------------------------------------------
// A tiny UI class for presenting tabular data
// ----------------------------------------------------------------------------
// Usage example:
// tableContainer.appendChild(
//   new ui.Table()
//    .addHeader(["Area","Revenue"])
//    .addData([
//       ["North", "14.5 M"],
//       ["South", "10.3 M"]
//     ])
//    .table
// )
// ----------------------------------------------------------------------------
     class Table {

       constructor() {
         this.table = createElement("TABLE")
         this.thead = this.table.createTHead()
         this.tbody = this.table.createTBody()
       }

// Expects an array, containing the header texts
       addHeaders(headers) {
          var tr = this.thead.insertRow()
          for (let col of headers) {
            tr.insertCell().textContent = col
          }
          return this
       }

// Expects an array of arrays, containing the cell data
       addData(data) {
         for (let row of data) {           
           let tr = this.tbody.insertRow()
           for (let cell of row){             
             let td = tr.insertCell()
             if (typeof cell == "object") {
               setAttributes(td,cell)
             } else {
               td.textContent = cell
             }
           }
         }
         return this  
       }
     }
  

// ----------------------------------------------------------------------------
// Create an element with attributes
// ----------------------------------------------------------------------------  
   function createElement(name,atts) {
     var e = document.createElement(name)
     setAttributes(e,atts)
     return e
   }
   
// ----------------------------------------------------------------------------
// Set attributes on a (given) element
// ----------------------------------------------------------------------------  
   function setAttributes(e,atts) {
     if (atts) {
       for (let a in atts) {
         if (a=="childNodes") {
           for (let n of atts[a]) e.appendChild(n)
         } else if (a=="textContent" || a=="innerHTML") {
           e[a] = atts[a]   
         } else if (a=="classList") {
           atts[a].forEach(c=>e.classList.add(c))        
         } else {
           e.setAttribute(a,atts[a])
         }
       }
     }
   }

  
// ----------------------------------------------------------------------------
// Handle user events ("action"s)
// ----------------------------------------------------------------------------  
  function registerHandlers(event,handlers,opt={}) {

    setDefaultOptions()

    for (let action of Object.keys(handlers)) {
      let elements = getElementsByAction(action,opt.selector)
      if (elements.length) {
        for (let e of getElementsByAction(action,opt.selector)) {
          e.addEventListener(event,evt=>mainCallback.call(this,evt,handlers[action]))
        }  
      } else {
        console.log(`No element found for action ${action}`)
      }
    }    

    function setDefaultOptions() {
      opt.mainCallback = opt.mainCallback || mainCallback
    }

  }  
  
// CSS Selector to return elements for a given action (changeable by module consumer)
  function actionSelector(action) {
    return `[data-action="${action}"]`
  }

// Shorthand to give an array of all elements for an action
  function getElementsByAction(action,selector=actionSelector) {
    return Array.from( document.querySelectorAll(selector(action)))
  }  

// Main callback, wraps all single registered callbacks
// Rewritable by module consumer
  function mainCallback(event,callback) {
     try {
       callback.call(this,event)
     } catch (e) {
       alert(e.message)
     }
  }

// ----------------------------------------------------------------------------
// Field selection: which fields are disabled, which are invisible
// ----------------------------------------------------------------------------  
function fieldSelection(opt) {  
  evaluateFieldSelection(opt.disabled,(e,state)=>e.disabled=state)
  evaluateFieldSelection(opt.invisible,(e,state)=>e.style.display=state?"none":"")
}

function evaluateFieldSelection(actions,setState) {
  if (typeof actions != "object") return
  for( let action in actions) {
    for (let e of getElementsByAction(action)) {
      setState(e,actions[action])
    }
  }
}

// ----------------------------------------------------------------------------
// Shortcuts for HTTP request processing
// ----------------------------------------------------------------------------
  function Request() {

    return {
      do:doRequest,
      post:post 
    }
    
// Post requests, talking in JSON
   function post(url,data,callback) {
      return doRequest({
        url:url,
        callback:callback && function(){
          var responseData = JSON.parse(this.responseText)
          callback.apply(this,responseData)
        },
        data:JSON.stringify(data),
        action:"POST",
        headerFields:{"Content-Type":"application/javascript"}
      })
    }    

// General-purpose requests
    function doRequest(opt) {
      var data = opt.data || null
      var action = opt.action || "GET"
      var url = opt.url || ""
      var async = !!opt.callback || !opt.sync
      var headerFields = opt.headerFields || {}
      var xhr =  new XMLHttpRequest()
      xhr.open(action,url,async)
      if (typeof opt.callback == "function") { 
        requestor.addEventListener("load",opt.callback) 
      }
      for (let field in headerFields) {
         requestor.setRequestHeader(field,headerFields[field])
       }
      requestor.send(data)
      return async ? requestor : requestor.responseText
    }  
  }  

// ----------------------------------------------------------------------------
// Public interface
// ----------------------------------------------------------------------------
  return {
    fieldSelection:fieldSelection,    
    Table:Table,
    createElement:createElement,
    Request:Request(),
    registerHandlers:registerHandlers,
    actionSelector:actionSelector
  };


})()