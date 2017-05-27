(function(global){

   "use strict";

   const inputFiles     = document.getElementById("property-files")
   const tableContainer = document.getElementById("table-container")
   const editMode       = !!document.location.search.match(/\bedit\b/)
   var   propList
   
   setHandlers()
   fieldSelection()

// -------------------------------------------------------------------
// Define handlers for user events
// -------------------------------------------------------------------
   function setHandlers() {
     var clickHandlers = {
        "reload": handleReload,
        "save": handleSave
     }
     ui.registerHandlers("click",clickHandlers)
     inputFiles.addEventListener("change",handleChooseFiles)
     
     tableContainer.addEventListener("input",handleInput)
     if (editMode) tableContainer.addEventListener("mouseover",handleOnMouseOver)
     
   }


// -------------------------------------------------------------------
// Make parts of the UI invisible or disabled, depending on the mode
// -------------------------------------------------------------------
  function fieldSelection() {
    var dataLoss = getDataLoss()
    ui.fieldSelection({
      invisible:{
        "save":!editMode,
      },
      disabled:{
        "reload":!tableContainer.querySelector("table"),
        "save":editMode && !dataLoss,
      }
    })
    
  }
   
// -------------------------------------------------------------------
// The user selected some files via button "Choose files"
// -------------------------------------------------------------------
   function handleChooseFiles(evt) {
     var files = Array.from(this.files)
     var status
     if (files.length) {
       status = files.map(f=>f.name).join(',')
       reload(files)
     }
     else {
       status = "No files selected"
     }
     document.getElementById("selected-files").textContent = status      
   }
   
// -------------------------------------------------------------------
// The user clicked "Compare"
// -------------------------------------------------------------------
   function handleReload(evt) {
     var files = inputFiles.files
     if (files.length === 0) {
       throw new Error("Bitte Dateien auswählen")
     }
     reload(files)
   }

// -------------------------------------------------------------------
// Read the given files, compare and display them
// -------------------------------------------------------------------
   function reload(files) {
     readFiles(files).then(pList=>{
       compare(pList)
     }).then(fieldSelection)
   }     

// -------------------------------------------------------------------
// Compare the given property objects and display them
// -------------------------------------------------------------------
   function compare(pList) {
     propList = pList
     propList.sort((a,b)=>a.name > b.name)
     var t = prepareTableData(propList)
     showTable(t)
   }


// -------------------------------------------------------------------
// Restore the objects' state before change (discard changes)
// (Currently unused)
// -------------------------------------------------------------------
  function handleRestore() {
    propList.forEach(p=>p.restore())
    compare(propList)
  }

// -------------------------------------------------------------------
// The user edited cell content
// -------------------------------------------------------------------
   function handleInput(e) {
     var cell = e.target
     if (cell.nodeName != "TD") return
     // Value before change 
     var oldValue = cell.getAttribute("data-old-value")
     // Current value = value after change
     var newValue = getCellText( cell )
     // Leave if there were no changes     
     if (newValue == oldValue) return
     // Key (first column) or value (subsequent columns) changed?
     if (cell.cellIndex == 0) {
        // Key changed
        if (newValue.match(/\S/)) {
          updateKey( cell )
        }
     } else {
        // Value changed
        var key = getCellText( cell.parentNode.firstElementChild )
        updatePropertyValue(
          cell.cellIndex-1,
          key,
          newValue)
     }    
     // Save this change
     cell.setAttribute("data-old-value",newValue)
     // Mark blank cells   
     cell.classList.toggle("empty",!/\S/.test(newValue))
     // Recompute button states
     fieldSelection()
   }

  // In change mode, offer the "delete" icon
  function handleOnMouseOver(e) {
    var cell = e.target;
    // Only on table cell level
    if (cell.nodeName != "TD") return
    // If the value is missing anyway, "delete" makes no sense
    if (cell.classList.contains("missing")) return
    // An empty cell requires a real text node as first child
    // Otherwise, the "contentEditable" attribute won't work properly
    if (cell.classList.contains("empty")) setCellText(cell," ")
    // Not if the icon had already been created earlier
    var deleteArea = cell.querySelector(".delete")
    if (!deleteArea) {
      // First mouseover: create it
      deleteArea = document.createElement("div")
      // Mark the div as delete area
      deleteArea.className = "delete"
      // It's not editable, unlike the rest of the cell
      deleteArea.contentEditable = false
      // The icon as unicode symbol: 
      deleteArea.textContent = "✖"
      // Plug it into cell
      cell.appendChild(deleteArea)
      // Attach the "handleDelete" function
      deleteArea.addEventListener("click",handleDelete)
    }    
  }
  
// -------------------------------------------------------------------
// Change the key
// -------------------------------------------------------------------
  function updateKey(cell) {
    var oldKey = cell.getAttribute("data-old-value")
    var newKey = getCellText( cell )
    propList.forEach((p,i)=>{
      let newValue = getCellText( cell.parentElement.cells[i+1] )
      p.changeKey(newKey,oldKey,newValue)
    })
  }

// -------------------------------------------------------------------
// Change a property value in the Properties instance
// -------------------------------------------------------------------
  function updatePropertyValue(i,key,value) {
    propList[i].set(key,value)
  }
  
  
// -------------------------------------------------------------------
// Read a value from a table cell
// -------------------------------------------------------------------
  function getCellText(cell) {
    // Check the first text node only
    var text = cell.firstChild && cell.firstChild.data || ""
    // If the cell is marked empty, the content is ""
    if (!text.match(/\S/) && cell.classList.contains("empty")) return ""
    return text
  }
  
// -------------------------------------------------------------------
// Set a table cell with a value
// -------------------------------------------------------------------
  function setCellText(cell,text) {
    if (cell.childNodes.length == 0 || cell.firstChild.nodeType == Node.TEXT_NODE) {
      var textNode = document.createTextNode(text)
      cell.insertBefore(textNode,cell.firstChild)
    }
    else {
      cell.firstChild.data = text
    }
  }
  
  
// -------------------------------------------------------------------
// Delete one or several key/value pairs
// -------------------------------------------------------------------
  function handleDelete(e) {
    if (!e.target.classList.contains("delete")) return
    var cell = e.target.parentElement
    var row = cell.parentElement
    var key = getCellText( row.firstElementChild )
    var value = getCellText( cell )
    // Does the cell belong to the column of a single properties file? 
    var index = cell.cellIndex
    if (index > 0) {
      // Delete value in a single properties file
      propList[index-1].deleteValue(key,value)
    } else {
      // Delete values of that row from all properties files 
      propList.forEach((p,i)=>p.deleteValue(key,getCellText(row.cells[i+1])))
    }    
    compare(propList)
    e.stopPropagation()
    fieldSelection()
  }
    
// -------------------------------------------------------------------
// The user chose "Save"
// Save changed files asynchronously, then do field selection
// -------------------------------------------------------------------
  function handleSave() {
    if (editMode) {
      save(propList,inputFiles.files).then(fieldSelection())
    }
  }

// -------------------------------------------------------------------
// Save all files that have been changed by the user 
// -------------------------------------------------------------------
  function save(propList,files) {
    return Promise.all( 
      propList
        .map((p,i)=>[p,files[i]])
        .filter(pf=>pf[0].dataLoss)
        .map(
          pf=>saveFile(pf[0],pf[1])
        )
    )
  }  
 
// -------------------------------------------------------------------
// Promise to save a single file using fs
// -------------------------------------------------------------------
  function saveFile(properties,file) {
    const fs = require("fs")
    return new Promise(function(resolve,reject) {
      if (file.path != '') {
        var content = properties.stripErrors().sort().toString()      
        fs.writeFile(file.path, content, err=>{
          if (err) {
            reject(err)
          } else {
            properties.onCommit()
            resolve(properties)
          }
        }) 
      }
    })
  }

// -------------------------------------------------------------------
// Determine whether some data of some property files has changed
// -------------------------------------------------------------------
  function getDataLoss() {
    return !!propList && propList.some(p=>p.dataLoss)
  }


// -------------------------------------------------------------------
// Read and parse all the given files
// -------------------------------------------------------------------

// Promise to read and parse all the specified property files
   function readFiles(files) {
     var aFiles = Array.from(files)
     return Promise.all(aFiles.map(file=>parsePropertyFile(file)))
   }

// -------------------------------------------------------------------
// Read and parse a single property file
// -------------------------------------------------------------------
  function parsePropertyFile(file) {
    return new Promise((resolve,reject)=>{
      var rdr = new FileReader()
      rdr.addEventListener("load",(evt)=>{
        var rows = rdr.result.split(/\r\n?|\n/)
        var prop = new i18n.Properties({name:file.name,rows:rows})
        resolve(prop)
      })
      rdr.readAsText(file)
    })
  }   

// -------------------------------------------------------------------
// Display the table
// - Map the result to the format required by ui.Table
// - Insert new HTML table into table Container
// -------------------------------------------------------------------
   function showTable(t) {

     tableContainer.innerHTML = ""
     
     var ht = new ui.Table()
     ht.addHeaders(t.headers)
     ht.addData(t.data)
     tableContainer.appendChild(ht.table)

   }

// -------------------------------------------------------------------
// Compare the property objects via i18n module,
// then map them to UI table data format (input for ui.Table)
// -------------------------------------------------------------------
   function prepareTableData(propList) {
     
     var t = {}        
     
     t.headers = ["Key"]
     for (let p of propList) {
       t.headers.push( p.name.replace(/\.properties$/,""))        
     }
     t.data = mapToTableCells(i18n.compareProperties(propList))
     return t;

     function mapToTableCells(data) {
        return data.map(row=>
          row.map((cell,i)=>{
            if (!cell) return null;
            var value = cell.missing ? " " : cell.value
            var o = { 
              textContent:value, // Content is not editable if there is no child node of type text at all
              "data-old-value":value
            }
            if (i>0) {
              Object.assign(o,{
                title:cell.title,
                classList:getClassList(cell)
              })
            }  
            if (editMode) o.contentEditable = true
            return o  
          })
        )
     }

     function getClassList(cell) {
        return ["missing","empty","multiple"].reduce((acc,prop)=>{
          if (cell[prop]) acc.push(prop)
            return acc
          },[])
      }
     
   }
   
})(window)
