/*
	TODO:
		Storage
*/

$(document).ready(function(){
	
	var drawView, barHeight = $("#topNavbar").height(), frame = Frame.make(0,barHeight,window.innerWidth,window.innerHeight-barHeight);
	drawView = new DrawView({
		frame:frame,
		id:"draw-view",
		color:{r:0,g:0,b:0}
	});
	$("body").append(drawView.html());
	drawView.ready();
	
	$(".colorOption").click(function(){
		var arr = $(this).find("span").css("background-color").split("(");
		arr = arr[1].split(",");
		var r = parseInt(arr[0]), g = parseInt(arr[1]), b = parseInt(arr[2]);
		drawView.setColor(r, g, b);
	});
	
	$(".sizeOption").click(function(){
		drawView.strokeRadius = parseInt($(this).attr("id"));
	});
	
	$("#clearCanvas").click(function(){
		drawView.clearDocument();
	});
	
	$("#undo").click(function(){
		drawView.undo();
	});
	
	$("#redo").click(function(){
		drawView.redo();
	});
	
	
	$("#newDoc").click(function(e){
		drawView.loadNewDocument();
	});
	
	$("#openDoc").click(function(){
		var docs = Html5Doc.getDocumentNamesForStore('DrawView'), doc,
			html = "<div class='modal hide fade' data-show=true id=openDocDialog><div class='modal-header'>Open Document<button type='button' class='close' data-dismiss='modal' aria-hidden='true'>&times;</button></div><div  class='modal-body' > Select Document: <select id=openDocName>";
		for (var i=0,len=docs.length;i<len;i++) {
			doc = docs[i];
			var escDoc = doc.replace(/"/g, '&quot;');
			html += '<option value="'+escDoc+'">'+doc+"</option>";
		}
		html += '</select></div><div class="modal-footer"><a href="#" class="btn" data-dismiss="modal">Cancel</a><a href="#" class="btn btn-primary">Open</a></div></div>';
		$("body").append(html);//"<div id=openDocDialog>Enter name:<input id=openDocName /></div>");
		
		$( "#openDocDialog" ).modal('show').on('hidden', function(){
			$(this).remove();
		})
		.find(".btn-primary").click(function(){
			var name = $("#openDocName").val();
			if (name.length) {
				$( "#openDocDialog" ).modal('hide');
				var doc = Html5Doc.getDocument(name,'DrawView');
				if (doc)
					drawView.loadDocument(doc);
			}
		});
	});
	
	
	$("#saveDocAs").click(function(){
		$("body").append('<div class="modal hide fade" data-show=true id=saveDocDialog><div class="modal-header">Save Document<button type="button" class="close" data-dismiss=modal" aria-hidden="true">&times;</button></div><div  class="modal-body" >Enter name:<input id=saveDocName /></div><div class="modal-footer"><a href="#" class="btn" data-dismiss="modal">Cancel</a><a href="#" class="btn btn-primary">Save</a></div></div>');
	
		$( "#saveDocDialog" ).modal('show').on('hidden', function(){
			$(this).remove();
		})
		.find(".btn-primary").click(function(){
			var name = $("#saveDocName").val();
			if (name.length) {
				$( "#saveDocDialog" ).modal('hide');
				drawView.currentDocument.name = name;
				Html5Doc.saveDocument(drawView.currentDocument, 'DrawView');
			}
		});
		
	});
	
	$("#saveDoc").click(function(){
		if (!drawView.currentDocument.name) {
			$("#saveDocAs").trigger('click');
		}
		else {
			Html5Doc.saveDocument(drawView.currentDocument, 'DrawView');
		}
	});

});
