(function(global){

  "use strict";

/* PropertyRow

This class keeps the data of a single row of a property file.
It also contains the logic for parsing a single text row of 
a property file. 

 Attributes:
+---------+-------------------------------------------+
| Name    | Value                                     |
+---------+-------------------------------------------+
| key     | Key                                       |
| value   | Value                                     |
| comment | Comment (for rows starting with '#')      |
| error   | Flag "Invalid line"                       |
| blank   | Flag "Line contains only whitespace"      |
| empty   | Flag "No value specified"                 |
| input   | Original line in case error = true        |
+---------+-------------------------------------------+
 
*/

  class PropertyRow {
    constructor(row) {
      if (row!==undefined) {
        Object.assign(this,this.parseRow(row))
      }
    }
    parseRow(row) {
      var o = {}
      // Parse text line into structured PropertyRow object
      // Using a regex, which represents the rules
      // - Arbitrary whitespace at the beginning allowed
      // - Followed by a 'key=value' instruction, where key must not contain '#'
      // - Or followed by a '#' and arbitrary more characters ( = comment )
      // - A line consisting only of whitespace is allowed 
      row.replace(
        /\s*(?:(?:([^#=\s]+)\s*=(.*))|#\s*(.*?)\s*$)/,
        (match,key,value,comment)=>
          Object.assign(o, {
            key:key,
            value:value,
            comment:comment
          }))
      if (Object.keys(o).length == 0) {
        o = (/\S/.test(row)) ? { error:true, input:row } : { blank: true, comment: "" }
      }
      if (o.key && !/\S/.test(o.value)) o.empty = true
      return o
    }
    clone() {
      var r = new PropertyRow()
      return Object.assign(r,this)
    }
  }

/*

Class Properties 
An instance represents a property file

Attributes:

+----------+----------------------------------------------------------------------+
| rows     | Array of PropertyRow's, containing parsed text rows                  |
| keyMap   | Hash table of all value rows for a given key                         |
| dataLoss | Flag: there were changes (virtual property)                          |
| old      | Referen to original (on changes)                                     |
+----------+----------------------------------------------------------------------+

Constructor Parameters
+------+------------------------------------+
| rows | Array of all text rows of the file |
| name | Name (optional)                    |
+------+------------------------------------+

*/

  class Properties {
    
//-----------------------------------------------------------------------    
// Constructor is usually called at least with a 'rows' array
//-----------------------------------------------------------------------    
    constructor(opt={}) {
      if (opt.name) this.name = opt.name
      this.rows = opt.rows ? opt.rows.map(row=>new PropertyRow(row)) : []
      this.keyMap = buildKeyMap(this.rows)
      this.old = null
      this.fileHandle = opt.fileHandle 
    }
    
//-----------------------------------------------------------------------    
// Returns the set of all keys 
// (in the file itself, a key may occur more than once)
//-----------------------------------------------------------------------    
    getKeys() {
      return this.rows.reduce((keys,p)=>{
        if (p.key) keys.add(p.key)
        return keys
        },new Set())
    }
    
//-----------------------------------------------------------------------    
// The different values assigned to one key (there may be more than 1)
//-----------------------------------------------------------------------    
    getAllRows(key) {
      return this.keyMap[key] || []
    }

//-----------------------------------------------------------------------    
// Get the property row object for a key and a value
// If no value given, get the first property row for the key
//-----------------------------------------------------------------------    
    getRow(key,value=null) {
       var r = this.getAllRows(key)
       if (r.length == 0) return undefined
       return r.find(row=>value === null ||row.value==value)
    }

//-----------------------------------------------------------------------    
// Sort by key
// Concommitant comments before a property declaration
// have to be moved together with that row 
//-----------------------------------------------------------------------    
    sort() {
      this.onChange()
      var keys = Object.keys(this.keyMap).sort((a,b)=>a.localeCompare(b))
      var rows = this.preamble.concat(new PropertyRow(""))
      for (let key of keys) {
        for (let row of this.keyMap[key]) {
          for (let cr of this.getCommentRows(row)) {
            rows.push(cr)
          }
          rows.push(row)          
        }
      }
      this.rows = rows
      this.keyMap = buildKeyMap(rows)
      return this
    }
    
//-----------------------------------------------------------------------    
// If a file has been saved (a function not part of this class)
// The "old" attribute becomes obsolete: get rid of it
//-----------------------------------------------------------------------    
    onCommit() {
      this.old = null
    }

//-----------------------------------------------------------------------    
// Have data been changed
//-----------------------------------------------------------------------    
    get dataLoss() {
      return !!this.old
    }

//-----------------------------------------------------------------------    
// On change access, the original has to be put aside to attribute "old" 
//-----------------------------------------------------------------------    
    onChange() {
      if (!this.dataLoss) {
        this.old = this.clone() 
      }
      return this
    }

//-----------------------------------------------------------------------    
// Change first value row for this key to new value
// Put it at the end of the file (default, index = -1),
// or put it before row given by "index"
//-----------------------------------------------------------------------    
    set(key,value,index=-1) {
      this.onChange()
      if (this.keyMap.hasOwnProperty(key)){
        let first = this.keyMap[key][0]
        first.value = value
      } else {
        this.addNewProperty(key,value,index)
      }
      return this
    }
    
//-----------------------------------------------------------------------    
// Change a given value for a given key to a new value
//-----------------------------------------------------------------------    
    changeKey(newKey,oldKey,oldValue) {
      var index = this.deleteValue(oldKey,oldValue,true)
      this.set(newKey,oldValue,index)
      return this
    }

//-----------------------------------------------------------------------   
// Delete a row given by key and value
// Also delete comments if there is no further value for that key
// (can be switched off by parameter 'preserveComments' 
//-----------------------------------------------------------------------    
    deleteValue(key,value=null,preserveComments=false) {
      var row = this.getRow(key,value)
      if (!row) return    
      this.onChange()  
      // Wenn array dann ganz leer: Auch Kommentare für key löschen
      if (this.keyMap[key].length == 1) {
        if (!preserveComments) {
          this.getCommentRows(row).forEach(cr=>this.deleteRow(cr))
        }
        delete this.keyMap[key]         
      } else {
      // row aus dem keyMap-Hash löschen
        this.keyMap[key].splice(this.keyMap[key].indexOf(row),1)
      }
      // row aus dem rows-Array löschen
      return this.deleteRow(row)      
    }

//-----------------------------------------------------------------------    
// Delete a given PropertyRow instance from the object
//-----------------------------------------------------------------------    
    deleteRow(row) {
      if (row === undefined) return
      var i = this.rows.indexOf(row)
      if (i>=0) {
        this.onChange()  
        this.rows.splice(i,1)
      }
      return i
    }

//-----------------------------------------------------------------------    
// Find index of the key/value pair 
// (or of the first pair for that key, if no value is given)
//-----------------------------------------------------------------------    
    indexOf(key,value=null) {
      return this.rows.findIndex(row=>
        row.key == key && (value === null || row.value == value)
      )
    }
    
//-----------------------------------------------------------------------    
// If rows could not be parsed into a valid key/value pair or comment,
// they get a PropertyRow object of status 'error'
// This method deletes all error objects from the "rows" array
//-----------------------------------------------------------------------        
    stripErrors() {
      var firstError = this.rows.findIndex(row=>row.error) 
      if (firstError>-1) {
        this.onChange()
        if (firstError > 0 && this.preamble.length == firstError) {
          this.rows[firstError] = new PropertyRow("") 
        }
        this.rows = this.rows.filter(row=>!row.error)
      }
      return this
    }

//-----------------------------------------------------------------------        
// Restore old version ( = undo all changes)
//-----------------------------------------------------------------------        
    restore() {
      if (this.dataLoss) {
        this.rows   = this.old.rows
        this.keyMap = this.old.keyMap
        this.old    = null 
      }
      return this
    }

//-----------------------------------------------------------------------        
// Get the comments before a given property row object
//-----------------------------------------------------------------------        
    getComment(row) {
      return this.getCommentRows.map(row=>row.comment)
    }

//-----------------------------------------------------------------------        
// Get the comment objects before a given property row object
//-----------------------------------------------------------------------        
    getCommentRows(row) {
      var commentRows = []
      if (row.key) {
        var i,i0 = this.rows.indexOf(row)
        if (i0 > 0) {
          for (i=i0-1;i>=0;i--) {
            if (this.rows[i].comment!==undefined) {
              commentRows.unshift(this.rows[i])
            } else break            
          }
          if (i==-1) {
            // Präambel nicht mitzählen
            commentRows.splice(0,this.preamble.length)
            if (commentRows[0].blank) commentRows.splice(0,1)
          }
        }
      }
      return commentRows
    }

//-----------------------------------------------------------------------        
// Get the preamble - the first comment rows of the file
//-----------------------------------------------------------------------        
    get preamble() {
      var preamble = []
      var next = {}
      for (let i=0;i<this.rows.length;i++) {
        if (!this.rows[i].comment) {
          next = this.rows[i]
          break
        }
        preamble.push(this.rows[i])
      }
      return next.key ? [] : preamble
    }

//-----------------------------------------------------------------------        
// Add a new key/value pair - at the end (default) or at a given index
//-----------------------------------------------------------------------        
    addNewProperty(key,value,index=-1) {
      this.onChange()
      var pr = new PropertyRow()
      pr.key   = key
      pr.value = value
      if (index == -1) {
        this.rows.push(pr)
      } else  {
        this.rows.splice(index,0,pr)
      }
      if (this.keyMap.hasOwnProperty(key)) {
        this.keyMap[key].push(pr)
      } else {
        this.keyMap[key] = [pr]
      }
    }

//-----------------------------------------------------------------------        
// Render the object in its current form into a string with line breaks
//-----------------------------------------------------------------------        
    toString() {
      return this.rows.map(row=>{
        if (row.key)
          return `${row.key}=${row.value}`
        else if (row.comment) 
          return `# ${row.comment}`
        else return ``
      }).join('\n')
    }

//-----------------------------------------------------------------------        
// Clone this object into a new one, deep copies of "rows" and "keyMap"
//-----------------------------------------------------------------------        
    clone() {
      var p = new Properties() 
      p.rows = this.rows.map(row=>row.clone())
      p.keyMap = buildKeyMap(p.rows)
      return p
    }


  }

//-----------------------------------------------------------------------        
// Build a keyMap from a given rows array
//-----------------------------------------------------------------------        
  function buildKeyMap(rows) {
    var keyMap = {}
    rows.forEach(p=>{
      if (p.key) {
        if (!keyMap.hasOwnProperty(p.key)) keyMap[p.key] = []
        keyMap[p.key].push(p)
      }
    })
    return keyMap
  }

/* 

Function compareProperties: Compare several property files with each other

Results in a two-dimensional array (matrix)
The first column contains the keys, alphabetically sorted
One successive column for each Properties object
If a key has multiple values in a file, there are as many rows as needed for this key

Cell data are plain javascript objects, with members
  value 
  title          : An explanation for this row
  empty    (flag): if the value is only whitespace
  missing  (flag): if this key has no value in this file (if key is unique)
  multiple (flag): if this is one of multiple values for the key
 
*/

  function compareProperties(propList) {
    
    // Generate an overall cross-file list of all keys 
    var allKeys = new Set()
    for (let p of propList) {
      p.getKeys().forEach(key=>allKeys.add(key))
    }
    // Make it an array and sort it 
    allKeys = Array.from(allKeys).sort((a,b)=>a.localeCompare(b))
    
    var result = []
    for ( let key of allKeys) {
      
      // Collect all the values for that key in all files
      let values = Array(propList.length)
      propList.forEach((p,i)=> {
        values[i] = p.getAllRows(key)
        if (values[i].length == 0) values[i].push( { missing:true } )
        var multiple = (values[i].length > 1)
        values[i].forEach(q=>q.multiple = multiple)
      })

      // How many rows are necessary to represent all values of all files
      var nrows = Math.max.apply(null,values.map(v=>v.length))
      
      // Build these rows
      for (let i=0;i<nrows;i++) {
        // The first column of each row contains the key
        let row = [ { value:key } ] 
        // In the following columns, show the values in the different files
        values.forEach((v,k)=>{
          let p = propList[k]
          let o = cellDataFromPropertyRow(
            key,
            v[i],
            v[i] !== undefined ? p.indexOf(key,v[i].value) : -1)
          row.push(o)
        })
        result.push(row)  
      }
    }
    return result

    function cellDataFromPropertyRow(key,q,index=-1) {
      var o 
      if (q) {
        if (q.missing) {
          o = {
             missing:true,
             title: `No value for property ${key}`
          }
        } else {
          o = {
              empty: q.empty,
              value: q.value,
              multiple: q.multiple,
              title: `Defined in row ${index}`
          }
        }                  
      }
      return o
    }      
  }


//-----------------------------------------------------------------------        
// Public interface
//-----------------------------------------------------------------------        
  global.i18n = {
    Properties:Properties,
    PropertyRow:PropertyRow,
    compareProperties:compareProperties
  }


})(typeof module == "undefined" ? this : module.exports)
