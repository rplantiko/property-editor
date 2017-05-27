(function(){

"use strict";

var assert,i18n;

// Setup the test frameworks, depending on environment
if (typeof window == "undefined") {  
  // My desktop environment (mocha / nodejs)
  let mut = process.env.MODULE_UNDER_TEST
  i18n = require(mut).i18n
  assert = require('chai').assert
} else {  
  // Browser (via testrunner page)
  i18n = window.i18n
  assert = chai.assert
}

var textlines = [
  "# Test",                            // File preamble
  "",                                  // Marker for end of preamble
  "# Parameter a is the fnord factor", // Parameter preamble
  "a=A fnord is just a fnord",         // Parameter
  "# Parameter c: gnuification",       // Parameter preamble
  "c=Rose bud",                        // Parameter
  "c=I said: Rose bud",                // Repeated parameter
  "b=Best of..."                       // Parameter, no preamble
]

suite("Parsing",()=>{
  var p = new i18n.Properties({name:"Test",rows:textlines});
  test("Parse all lines", ()=>{
      assert.equal(
        p.rows.length,
        textlines.length,
        "All lines should be parsed into the result (including empty lines)")
  })
  test("Parse parameters", ()=>{
      assert.deepEqual(
        p.getKeys(),
        new Set(['a','b','c']),
        "All parameters should be parsed")
  })
  test("Doubly defined parameters", ()=>{
      assert.equal(
        p.getAllRows('c').length,
        2,
        "All defining lines for a parameter should be parsed")
  })
})

suite("Comments",()=> {

  var p = new i18n.Properties({name:"Test",rows:textlines});

  test("Preamble",()=>{
    assert.equal(
      p.preamble.length,
      1,
      "Preamble should be detected")
    
   assert.equal(
     p.preamble[0].comment,
     "Test",
     "Preamble text should be parsed properly")

  })
  
  test("Blank line",()=>{
   assert(
     p.rows[1].blank,
     "Blank line should be detected")    
  })

  test("Pre-parameter comment",()=>{
    var row = p.getRow("a")
    var cr  = p.getCommentRows(row)

    assert.equal(
      cr.length,
      1,
      "Comment Row for parameter should be detected"
    )

    assert.equal(
      cr[0].comment,
      "Parameter a is the fnord factor",
      "Comment of parameter should be detected correctly"
    )

  })

  test("No pre-parameter comment",()=>{
    var row = p.getRow("b")
    var cr  = p.getCommentRows(row)

    assert.equal(
      cr.length,
      0,
      "No comment should be detected properly as such"
    )

  })  


})

suite("Change",()=>{

  var p

  setup(()=>{
    p = new i18n.Properties({name:"Test",rows:textlines})
  })


  test("Change single value",()=>{    
    p.set("b","Worst of...") 
    assert.equal(
      p.getRow("b").value,
      "Worst of...",
      "Changing value of single parameter with method 'set()'"
    )
  })

  test("Old version is preserved",()=>{    
    p.set("b","Worst of...") 
    assert.equal(
      p.old.getRow("b").value,
      "Best of...",
      "Old version should be preserved"
    )
  })

  test("Add new Value",()=>{    
    p.set("d","Top-10") 
    assert.equal(
      p.getRow("d").value,
      "Top-10",
      "New parameter should be added with 'set(key,value)'"
    )
  })


})

suite("Delete",()=>{

  var p 

  setup(()=>{
    p = new i18n.Properties({name:"Test",rows:textlines})
  })

  test("Delete one of multiple values",()=>{
    p.deleteValue("c","I said: Rose bud")
    assert.equal(
      p.getAllRows("c").length,
      1,
      "Second c value should be deleted"
    )  
  })


  test("Delete single value",()=>{
    p.deleteValue("b")
    assert.equal(
      p.getAllRows("b").length,
      0,
      "Key b should be deleted"
    )  

    assert(
      !p.keyMap.hasOwnProperty("b"),
      "Key b should be deleted from keyMap"
    )  

  })

  test("Delete value with comment",()=>{
    p.deleteValue("a")
    assert.equal(
      p.getAllRows("a").length,
      0,
      "Key a should be deleted"
    )  

    assert.equal(
      p.rows.filter(row=>row.comment && !!row.comment.match(/fnord/)).length,
      0,
      "All fnord comments should be removed, too"
    )


  })

})


suite("Sort",()=>{

  var p = new i18n.Properties({name:"Test",rows:textlines});
  p.sort()


  test("Save old version",()=>{

    assert(
      p.old instanceof i18n.Properties,
      "Old Version should be preserved"
    )

    assert.equal(
      p.rows.reduce((acc,row)=>{if (row.key) acc.push(row.key); return acc},[] ).join(","),
      "a,b,c,c",
      "Old Version should be preserved"
    )


  })
  


})


suite("Comparison",()=>{

  var p0 = new i18n.Properties({name:"Test",rows:textlines})
  var textlines2 = ['b=Fnords und kein Ende','c=ist eine Rose','d=Sonstiges']
  var p1 = new i18n.Properties({name:"Test2",rows:textlines2})
  var cmp = i18n.compareProperties([p0,p1])

  test("Detect missing parameter",()=>{
    var rows = cmp.filter(byKey('a'))
    assert.equal(
      rows.length,
      1,
      "Parameter 'a' is detected and has no multiple definitions")
    assert(
      !rows[0][1].missing,
      "Parameter 'a' is detected as defined in the first property file")
    assert(
      rows[0][2].missing,
      "Parameter 'a' is detected as missing in the second property file")


  })

  test("Detect all parameters",()=>{
    assert.deepEqual(
      cmp.reduce((acc,row)=>acc.add(row[0].value),new Set()),
        new Set(['a','b','c','d']),
        "All parameters (from both files) should be detected")
  })

  test("Group multiple parameters",()=>{
    var rows = cmp.filter(byKey('c'))
    assert.equal(
      rows.length,
      2,
      "A doubly defined parameter ('c') gives two values in the result table"
    )

    assert.deepEqual(
      new Set(rows.map(row=>row[1].value)),
      new Set(['Rose bud','I said: Rose bud']),
      "Both defined values are detected"
    )

    assert.equal(
      rows[0][2].value,
      'ist eine Rose',
      "Second value column, first row, contains the parameter value for 'c' of the second file"
    )

    assert.equal(
      rows[1][2],
      undefined,
      "Second value column, second row, for 'c' is left undefined"
    )

  })

  test("Detect additional parameters",()=>{
    var rows = cmp.filter(byKey('d'))

    assert.equal(
      rows.length,
      1,
      "A new parameter ('d') in the second property file should be detected"
    )

    var d1 = rows[0][1]
    var d2 = rows[0][2]

    assert(
      d1.missing,
      "Parameter 'd' should be detected as missing in the first property file"
    )

    assert.equal(
      d2.value,
      "Sonstiges",
      "Value of parameter 'd' from second property file should be detected properly"
    )

    
  })

  function byKey(key) {
    return row=>row[0].value == key
  }


})

suite("Errors", ()=>{

  test("Save original input",()=>{
    
    var p = new i18n.Properties({rows:["Invalid line"]})
    
    assert.equal(
      p.rows.length,
      1,
      "Error lines have to be added to the 'rows' array")

    assert(
      p.rows[0].error,
      "Unparseable row should be marked as erroneous" )

    assert.equal(
      p.rows[0].input,
      "Invalid line",
      "Original input has to be preserved in the input attribute" )
      
  })  

  test("Strip errors",()=>{

    var p = new i18n.Properties({rows:["Invalid line"]})
    
    p.stripErrors()
    
    assert.equal(
      p.rows.length,
      0,
      "Erroneous lines should be removed with stripErrors()") 
  
  })
  
  test("Strip errors in presence of a preamble",()=>{

    var p = new i18n.Properties({rows:["# Title","Invalid line","# Comment A","A=a"]})
    
    assert.equal(
      p.preamble.length,
      1,
      "Preamble should not include erroneous lines") 

    p.stripErrors()
    
    assert.equal(
      p.rows.length,
      4,
      "Erroneous rows should be deleted with stripErrors() - but separator for preamble should be inserted")
     
    assert.equal(
      p.preamble.length,
      1,
      "Preamble should not include erroneous lines") 
     
  })
  
  
  
})

})()

