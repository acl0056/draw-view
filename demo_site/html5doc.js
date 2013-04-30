/*	File: html5doc.js
*/
/*	Class: Html5Doc
	Html5Doc lets you store and retrieve document objects from local storage.  All work is done in class methods, because an instance IS the document that is saved to local storage.  Any properties you give to the document must be serializable into a JSON string.  Html5Doc uses a document store name, which allows you to easily group your documents by type, user, or whatever your implementation requires.
	
	Properties:
		name - A string name for this document. You must set the name property before saving.  You can also use this property to check whether to perform save or saveAs. If this his the same name as another document in the same store, it will save over that document.
*/
/*	Function: Html5Doc([name, store]) 
	Html5Doc constructor.
	
	Parameters:
		name - An optional string argument for this document's name.
		store - An optional string argument for this document's store.
*/
function Html5Doc() {
	this.name = arguments[0]?arguments[0]:null;
	this.store = arguments[1]?arguments[1]:null;
}

/*	Function: Html5Doc.getDocument(name, store)
	Retrieve a document from storage.
	
	Parameters:
		name - A string name of the document to retrieve.
		store - A string name of the document store, from which the document will be retrieved.
		
	Returns:
		The document, if found. If the store is not found or there is no document matching the name, returns undefined.  If an exception was raised from a compatibility issue, returns null.
*/
Html5Doc.getDocument = function(name, store) {
	
	// These exceptions are to help ensure proper implementation.
	if (!store || typeof store != 'string')
		throw {name:"Error",message:"store name is required"};
	if (!name || typeof name != 'string')
		throw {name:"Error",message:"document name is required"};
		
	try {
		var documentStore = JSON.parse(localStorage.getItem(store));
		if (documentStore) {
			var doc = documentStore[name];
			doc.__proto__ = Html5Doc.prototype;
			return doc;
		}
		return undefined;
	}
	catch(e) {
		// Any exceptions caught here are supressed, because they are probably from compatibility issues and not implementation issues.
		return null;
	}
};

/*	Function: Html5Doc.saveDocument(document [, store])
	Save a document to a document store.
	
	Parameters:
		document - The document object to save. The document must have a name property set.
		store - An optional argument that you must provide if the document.store property has not been set.
		
	Returns:
		True if successful, otherwise false.
*/
Html5Doc.saveDocument = function(document) {
	var store = document.store || arguments[1];
	
	// These exceptions are to help ensure proper implementation.
	if (!store || typeof store != 'string')
		throw {name:"Error",message:"store is required to save."};
	if (!document.name || typeof document.name != 'string')
		throw {name:"Error",message:"document name is required to save."};
		
	document.store = store;
	try {
		var documentStore = JSON.parse(localStorage.getItem(store)) || {};
		documentStore[document.name] = document;
		localStorage.setItem(store, JSON.stringify(documentStore));
	}
	catch(e) {
		// Any exceptions caught here are supressed, because they are probably from compatibility issues and not implementation issues.
		return false;
	}
	return true;
};

/*	Function: Html5Doc.removeDocument(document)
	Remove a document from local storage.
	
	Parameters:
		document - This can be the document object to remove, or an object with string name and store properties.
		
	Returns:
		True if successful, otherwise false.
*/
Html5Doc.removeDocument = function(document) {

	// These exceptions are to help ensure proper implementation.
	if (!document.name || typeof document.name != 'string')
		throw {name:"Error",message:"document name is required to remove."};
	if (!document.store || typeof document.store != 'string')
		throw {name:"Error",message:"store is required to remove."};
	
	try {
		var documentStore = JSON.parse(localStorage.getItem(document.store));
		delete documentStore[document.name];
		localStorage.setItem(document.store, JSON.stringify(documentStore));
	}
	catch(e) {
		// Any exceptions caught here are supressed, because they are probably from compatibility issues and not implementation issues.
		return false;
	}
	return true;
};

/*	Function: Html5Doc.keys(obj)
	Get the keys of an object, using the native implementation if available. Similar to _.keys in underscore.js, but defined here to avoid dependencies.
	
	Parameters:
		obj - A javascript object.
	
	Returns:
		The object keys.
*/
Html5Doc.keys = Object.keys || function(obj) {
	if (obj !== Object(obj)) throw new TypeError('Invalid object');
	var keys = [];
	for (var key in obj) if (Object.prototype.hasOwnProperty.call(obj, key)) keys[keys.length] = key;
	return keys;
};

/*	Function: Html5Doc.getDocumentNamesForStore(store)
	Get the names of all documents in a document store.
	
	Parameters:
		store - A string name of an object store.
		
	Returns:
		An array of string document names.
*/
Html5Doc.getDocumentNamesForStore = function(store){
	try {
		var documentStore = JSON.parse(localStorage.getItem(store)) || {};
		return Html5Doc.keys(documentStore);
	}
	catch(e) {
		// Any exceptions caught here are supressed, because they are probably from compatibility issues and not implementation issues.
		return null;
	}
};

/*	Function: Html5Doc.detect([debug])
	A safe method for testing if localStorage and JSON are available.
	
	Parameters:
		debug - An optional boolean argument for logging test failures. Defaults to false.
	
	Returns:
		True if localStorage is available, otherwise false.
*/
Html5Doc.detect = function() {
	var debug = arguments[0]?arguments[0]:false;
	
	// Test for JSON
	if (!window.JSON || !JSON.parse) {
    	if (debug)
    		console.log("Failed JSON test.");
    	return false;
	}
	
	// Test for localStorage
	var tester = "localStorage";
	try {
		localStorage.setItem(tester, tester);
		localStorage.removeItem(tester);
		return true;
	}
	catch(e) {
		if (debug)
			console.log("Failed localStorage test.");
		return false;
	}
};