/*
	Required:
		frame
		id
	Optional
		strokeRadius: 3
		maxError: 5
		color: {r:0,g:0,b:0}
		backgroundColor: white
		document: defaults to empty document
		
	TODO:
		Implement an efficient eraser algorithm.
*/
function DrawView(options) {
	if (!options)
		throw new TypeError("Expected required options argument.");
	if (!options.id)
		throw new TypeError("Expected required options.id argument.");
	if (!options.frame)
		throw new TypeError("Expected required options.frame argument.");
	this.id = options.id;
	this.frame = options.frame;
	this.strokeRadius = options.strokeRadius?options.strokeRadius:3;
	this.maxError = options.maxError?options.maxError:5.0;
	this.backgroundColor = options.backgroundColor?options.backgroundColor:"white";
	var _currentDocumentVersion = "1.0";
	
	this.setColor = function(r, g, b) {
		this.color = "rgba("+r+","+g+","+b;
	};
	if (options.color && options.color.r!==undefined && options.color.g!==undefined && options.color.b!==undefined)
		this.setColor(options.color.r, options.color.g, options.color.b);
	else 
		this.setColor(0, 0, 0);
	
	this.html = function() {
		var size = this.frame.size, origin = this.frame.origin;
		return"<div style=position:absolute;top:"+origin.y+"px;left:"+origin.x+"px; ><canvas id='"+this.id+
			"' width="+size.width+
			" height="+size.height+
			" style='position:absolute;top:0;left:0;"+
			"background-color:"+this.backgroundColor+"' />"+
			"<canvas id='"+this.id+
			"-temp' width="+size.width+
			" height="+size.height+
			" style='position:absolute;top:0;left:0;"+
			"background-color:rgba(0,0,0,0);' /></div>";
	};
		
	this.drawDot = function(x, y, radius) {
		var ctx = arguments[3]?arguments[3]:this.context;
		var grd = ctx.createRadialGradient(x, y, 0, x, y, radius);
		grd.addColorStop(0, this.color+ (ctx===this.tempContext?",0.333)":",1)") );
		grd.addColorStop(1, this.color+",0)");
		with(ctx) {
			fillStyle = grd;
			beginPath();
			arc(x, y, radius*2, 0, 2*Math.PI, false);
			fill();
			closePath();
		}
	};
	
	function tangentForPoints(v1, v2, v3, v4, v5) {
		var a0,b0,w2,w3,d1,d2,d3,d4,multiplier;
		
		// difference vectors
/* 		d1 = {x:v2.x-v1.x, y:v2.y-v1.y}; */
		d2 = {x:v3.x-v2.x, y:v3.y-v2.y};
		d3 = {x:v4.x-v3.x, y:v4.y-v3.y};
/* 		d4 = {x:v5.x-v4.x, y:v5.y-v4.y}; */
		
/* 		w2 = Math.abs( d3.x * d4.y - d3.y * d4.x ); */
		w2 = Math.abs( d3.x * (v5.y-v4.y) - d3.y * (v5.x-v4.x) );
/* 		w3 = Math.abs( d1.x * d2.y - d1.y * d2.x ); */
		w3 = Math.abs( (v2.x-v1.x) * d2.y - (v2.y-v1.y) * d2.x );
		
		a0 = w2*d2.x+w3*d3.x;
		b0 = w2*d2.y+w3*d3.y;
		
		multiplier = 1.0 / Math.sqrt(a0*a0+b0*b0);
		if (multiplier === Infinity)
			multiplier = 0;
		return {origin:v3, direction:{x:a0*multiplier, y:b0*multiplier}};
	}
	function distance(a, b) { 
		var x = b.x-a.x, y = b.y-a.y;
		return Math.sqrt( x*x + y*y ); 
	}
	
	this.getAngle = function(p1, p2, p3) {
		var dir1 = {x:p2.x-p1.x , y:p2.y-p1.y};
		var dir2 = {x:p3.x-p2.x , y:p3.y-p2.y};
		var len1 = Math.sqrt(dir1.x*dir1.x + dir1.y*dir1.y);
		var len2 = Math.sqrt(dir2.x*dir2.x + dir2.y*dir2.y);
		var norm1 = {x:dir1.x/len1, y:dir1.y/len1};
		var norm2 = {x:dir2.x/len2, y:dir2.y/len2};
		return Math.acos(norm1.x * norm2.x + norm1.y * norm2.y);
	}
	
	/*
		Setting up some parameters before interpolating the curve cuts out a handful operations for each interpolated point.
	*/
	var p0,p1,p2,p3,q0,q1,q2,q3;
	this.initializeCurve = function(v1, v2){
		var r = distance(v1.origin, v2.origin);
		
		p0 = v1.origin.x;
		p1 = r * v1.direction.x;
		p2 = 3 * (v2.origin.x - v1.origin.x) - r * (v2.direction.x + 2 * v1.direction.x);
		p3 = -2 * (v2.origin.x - v1.origin.x) + r * (v2.direction.x + v1.direction.x);
		
		q0 = v1.origin.y;
		q1 = r * v1.direction.y;
		q2 = 3 * (v2.origin.y - v1.origin.y) - r * (v2.direction.y + 2 * v1.direction.y);
		q3 = -2 * (v2.origin.y - v1.origin.y) + r * (v2.direction.y + v1.direction.y);
	};
	this.curveInterp = function(t){
		var t2 = t*t, t3 = t2*t;
		return {x: p0 + p1*t + p2*t2 + p3*t3, y: q0 + q1*t + q2*t2 + q3*t3};
	};
	this.linearInterp = function(t, start, end) {
		return start + (end-start)*t;
	};
	this.drawCurve = function(vStart, vEnd) {
		var wStart, wEnd = vEnd.width, currentWidth = wStart = vStart.width;
		var kStrokeStep = 0.45; //0.65f;
		var kIncrement = 0.001;  
		var curve = this.curveInterp;
		var linearInterp = this.linearInterp;
		var tFinder = 0;
		var tempVert;
		var drawVertex = curve(0.0);
		
		this.drawDot(drawVertex.x, drawVertex.y, wStart, arguments[2]);
		
		for (var t = 0; t+tFinder<1.0; t+=tFinder) {
			// Find next t appropriate for current width:
			//
			// set tempVert to the point at the end of this spline segment
			tempVert = curve(1.0);
			if (distance(drawVertex, tempVert) < (kStrokeStep*currentWidth)) {
				// if distance between last point drawn and spline segment end point
				// is below stroke step threshold,
				// then skip over the segment entirely.
				tFinder=1.0;
			}
			else {
				//tempVert = curve(1.0);
				if (distance(drawVertex, tempVert) == (kStrokeStep*currentWidth)) {
					// else if distance between last point drawn and spline segment end point
					// is equal to stroke step threshold,
					// then skip the following loop to determine next point
					// and draw spline segment end point.
					tFinder=1.0;
				}
				else {
					tempVert = curve(t);
					if (distance(drawVertex, tempVert) < (kStrokeStep*currentWidth)) {
						// if next spline point < distance threshold
						// find the next point in range.
						for (tFinder = kIncrement; distance(drawVertex, tempVert) < (kStrokeStep*currentWidth)&&t+tFinder<1.0; tFinder+=kIncrement) {
							tempVert = curve(t+tFinder);
						}
					}
					else {
						// draw spline segment start point t = 0
						tFinder = kIncrement;
					}
				}
				drawVertex = tempVert;
				currentWidth = linearInterp(t, wStart, wEnd);
				this.drawDot(drawVertex.x, drawVertex.y, currentWidth, arguments[2]);
			}
		}
	};
	this.drawLine = function(vStart, vEnd) {
		var wStart, wEnd = vEnd.width, currentWidth = wStart = vStart.width;
		var kStrokeStep = 0.45; //0.65f;
		var kIncrement = 0.001;
		var linearInterp = this.linearInterp;
		var tFinder = 0;
		var tempVert = {};
		var drawVertex = {x:vStart.x, y:vStart.y};
		
		this.drawDot(drawVertex.x, drawVertex.y, wStart, arguments[2]);
		
		for (var t = 0; t+tFinder<1.0; t+=tFinder) {
			// Find next t appropriate for current width:
			//
			// set tempVert to the point at the end of this spline segment
			tempVert.x = linearInterp(1.0, vStart.x, vEnd.x);
			tempVert.y = linearInterp(1.0, vStart.y, vEnd.y);
			var d = distance(drawVertex, tempVert), w = kStrokeStep*currentWidth;
			if (d < w) {
				// if distance between last point drawn and spline segment end point
				// is below stroke step threshold,
				// then skip over the segment entirely.
				tFinder=1.0;
			}
			else {
				//tempVert = curve(1.0);
				if (d == w) {
					// else if distance between last point drawn and spline segment end point
					// is equal to stroke step threshold,
					// then skip the following loop to determine next point
					// and draw spline segment end point.
					tFinder=1.0;
				}
				else {
					tempVert.x = linearInterp(t, vStart.x, vEnd.x);
					tempVert.y = linearInterp(t, vStart.y, vEnd.y);
					if (distance(drawVertex, tempVert) < w) {
						// if next spline point < distance threshold
						// find the next point in range.
						for (tFinder = kIncrement; distance(drawVertex, tempVert) < w && t+tFinder<1.0; tFinder+=kIncrement) {
							tempVert.x = linearInterp(t+tFinder, vStart.x, vEnd.x);
							tempVert.y = linearInterp(t+tFinder, vStart.y, vEnd.y);
						}
					}
					else {
						// draw spline segment start point t = 0
						tFinder = kIncrement;
					}
				}
				drawVertex = {x:tempVert.x, y:tempVert.y};
				currentWidth = linearInterp(t, wStart, wEnd);
				this.drawDot(drawVertex.x, drawVertex.y, currentWidth, arguments[2]);
			}
		}
	};
	
	/*	Function: VertexQueue()
		Constructor for private class VertexQueue. The queue object has methods for managing a queue of points, getters for removed and non-removed points, methods for estimating bessel end points, and methods for calculating and tracking a queue of two drawing tangents.
	*/
	function VertexQueue() {
		this.queue = [];
		this.t1 = null;
		this.t2 = null;
		this.push = function(obj) {
			var q = this.queue, len = q.length;
			if (len) {
				var last = q[len-1], dist = distance(obj, last);				
				if (dist > 1)
					q.push(obj);
			}
			else
				q.push(obj);
		};
		this.getCount = function(){
			var q = this.queue, len=q.length,count=0,i;
			for(i=0;i<len;i++) {
				if (!q[i].removed)
					count++;
			}
			return count;
		};
		this.each = function(callback){
			for(var i=0,q=this.queue,len=q.length;i<len;i++)
				callback(q[i]);
		};
		this.pop = function() { 
			while (this.queue.shift().removed) {}
		};
		this.reset = function() {
			this.queue = [];
		};
		this.getPoints = function() {
			var arr = [];
			for(var i=0,q=this.queue,len=q.length;i<len;i++)
				if (!q[i].removed)
					arr.push(q[i]);
			return arr;
		};
		this.getRemovedPoints = function() {
			// get all removed points between the sixth and seventh non-removed points.
			var arr = [], notRemoved = 0;
			for(var i=0,q=this.queue,len=q.length;i<len;i++) {
				if (q[i].removed) {
					if (notRemoved == 6)
						arr.push(q[i]);
				}
				else
					notRemoved++;
			}
			return arr;
		};
		this.estimateInitialTangent = function () {
			var points = this.getPoints();
			if (points.length != 3)
				throw Error("Should always have 3 good points when estimating initial tangent.");
			var p4 = points[2],
				p3 = points[1],
				p2 = points[0],
				s2 = {x: p3.x-p2.x, y: p3.y-p2.y},
				s1 = {x:(s2.x*2)-(p4.x-p3.x), y:(s2.y*2)-(p4.y-p3.y)},
				p1 = {x:p2.x-s1.x, y:p2.y-s1.y},
				p0 = {x:p1.x-((s1.x*2)-s2.x), y:p1.y-((s1.y*2)-s2.y)};
/*			 width4 = computeWidth(dist(p3, p4)); */
			this.queue.unshift(p0, p1);
			this.t2 = tangentForPoints(p0, p1, p2, p3, p4);
		};
		this.estimateEndPoints = function(){
			var points = this.getPoints();
			if (points.length != 5)
				throw Error("Should always have 5 good points when estimating end points.");
			var p4 = points[4],
				p3 = points[3],
				p2 = points[2],
				s2 = {x: p3.x-p2.x, y: p3.y-p2.y},
				s3 = {x: p4.x-p3.x, y: p4.y-p3.y},
				s4 = {x: 2*s3.x-s2.x, y: 2*s3.y-s2.y},
				s5 = {x: 2*s4.x-s3.x, y: 2*s4.y-s3.y},
				p5, p6;
			p5 = {x: p4.x+s4.x, y: p4.y+s4.y};
			p6 = {x: p5.x+s5.x, y: p5.y+s5.y};
			this.queue.push(p5, p6);
		};
		this.calculateTangent = function () {
			var points = this.getPoints();
			this.t1 = this.t2;
			if (points.length < 6)
				throw Error("Should always have at least six good points when calculating tangent.");
			this.t2 = tangentForPoints(points[1], points[2], points[3], points[4], points[5]);
			this.pop();
		};
	}
	this.vq = new VertexQueue();
	
	this.processStroke = function(stroke) {
		points = stroke.points;
		this.color = stroke.color;
		if (points) {
			var len = points.length, vq=this.vq;
			if (len) {
				if (len < 4) {
					// TODO
				}
				else {
					for (var j =0; j<len; j++){
						vq.push(points[j]);
						if (j == 3) {
							vq.estimateInitialTangent();
						}
						else if (j > 3) {
							// queue > 5
							// 0,1,2  3,4,5
							vq.calculateTangent();
							this.initializeCurve(vq.t1, vq.t2);
							this.drawCurve(points[j-3], points[j-2]);
							
							if (j == len-1){
								vq.estimateEndPoints();
								vq.calculateTangent();
								this.initializeCurve(vq.t1, vq.t2);
								this.drawCurve(points[j-2], points[j-1]);
								vq.calculateTangent();
								this.initializeCurve(vq.t1, vq.t2);
								this.drawCurve(points[j-1], points[j]);
							}
						}
					}
				}
				vq.reset();
			}
		}
	};
	
	this.pushStroke = function(stroke) {
		this.currentDocument.strokes.push(stroke);
		this.processStroke(stroke);
	};
	
	this.popStroke = function() {
		this.currentDocument.strokes.pop();
		this.setDocument(this.currentDocument);
	};
	
	this.addStrokeToDoc = function() {
		if (!this.currentDocument)
			throw new TypeError("No document");
			
		var doc = this.currentDocument;
		if (!doc.strokes)
			doc.strokes = [];
		var stroke = {
			points: this.stroke,
			color: this.color
		};
		doc.strokes.push(stroke);
		
		this.undoManager.register(
			this,this.popStroke,[],"Undo Add Stroke",
			this,this.pushStroke,[stroke],"Redo Add Stroke"
		);
		this.stroke = [];
	};
	
	this.tapGestureCallback = function(sender){
		if (sender.state == JSGestureRecognizerStateRecognized ) {
			var offset=$(this.canvas).offset(), 
				x = sender.translationOrigin.x-offset.left, 
				y = sender.translationOrigin.y-offset.top, t;
			var radius = this.strokeRadius;// - widthAdjust;
			var point = {x:x,y:y,radius:radius,removed:false};
			this.vq.push(point);
			this.drawDot(x, y, radius);
			sender.dx=0;
			sender.dy=0;
			this.vq.reset();
			this.stroke.push({x:x, y:y, width:radius});
			this.addStrokeToDoc();
		}
	};
	
	this.panGestureCallback = function(sender){
		if (sender.state == JSGestureRecognizerStateEnded || sender.state == JSGestureRecognizerStateChanged
			|| sender.state == JSGestureRecognizerStatePossible || sender.state == JSGestureRecognizerStateFailed) {
			var canvas = this.canvas, offset=$(canvas).offset();
			var x = sender.translationOrigin.x+sender.dx-offset.left, 
				y = sender.translationOrigin.y+sender.dy-offset.top, t;
			/* TODO: calculate width */
			var radius = this.strokeRadius;// - widthAdjust;
			var point = {x:x,y:y,width:radius,removed:false};
			var vq = this.vq;
			vq.push(point);
			
			if ( sender.state == JSGestureRecognizerStatePossible) {
				this.drawDot(x, y, radius);
				this.stroke.push({x:x, y:y, width:radius});
			}
			else if (sender.state == JSGestureRecognizerStateChanged) {
				var points = vq.getPoints();
				var count = points.length;
				if (count == 3) {
					vq.estimateInitialTangent();
				}
				else if (count > 8) {
					// Knot Removal: look for points to remove that are queued after the six used for drawing.
					// we are checking index 6 and we need 7 and 8 to do so.  That's a count of 9 before we can draw the curve.
					//
					// Corner detection - do not remove knots if it is a corner.
					//

					var corner = 1.618, hasCorner = false, getAngle = this.getAngle;
					for (var i=4; i<count; i++) {
						for (var j=4; j<count; j++) {
							if (i >= j)
								continue;
							for (var k=4; k<count; k++) {
								if (i>=k||j>=k)
									continue;
								if (getAngle(points[i], points[i+1], points[i+2]) >= corner) {
									hasCorner = true;
									break;
								}
							}
							if (hasCorner) break;
						}
						if (hasCorner) break;
					}
					//
					if (!hasCorner) {
						// Check for knot removal
						function cardinalCurve(z, a, b, c, t) {
							// javascript does not have convenience of inline functions or operator overloading,
							// so the most efficient code for this is quite ugly.
							var tension = 0.5, t2 = t*t, t3 = t*t2;
							var l = (2*t3-3*t2+1), m = (-2*t3+3*t2), n = tension*(t3-2*t2+t), o = tension*(t3-t2);
							return {x: a.x*l+b.x*m+(b.x-z.x)*n+(c.x-a.x)*o, y: a.y*l+b.y*m+(b.y-z.y)*n+(c.y-a.y)*o};
						}
						var distancePrev = distance(points[5], points[6]),
							t = distancePrev/(distancePrev+distance(points[6],points[7])),
							error = distance(points[6],cardinalCurve(points[4],points[5],points[7],points[8],t)),
							maxError = this.maxError, 
							removeKnot = error < maxError;
						if (removeKnot) {
							// If removing this knot puts the error for other consecutive removed knots over maxError,
							// then don't remove this knot.
							var removedPoints = vq.getRemovedPoints(),
								len=removedPoints.length;
							for (var i=0; i<len; i++) {
								var removed = removedPoints[i];
								distancePrev = distance(points[5], removed);
								t = distancePrev/(distancePrev+distance(removed, points[7]));
								error = distance(removed,cardinalCurve(points[4],points[5],points[7],points[8],t));
								if (error >= maxError) {
									removeKnot = false;
									break;
								}
							}
						}
						if (removeKnot)
							points[6].removed = true;
					}
					points = vq.getPoints();
					if (points.length > 8) {
						vq.calculateTangent();
						this.initializeCurve(vq.t1, vq.t2);
						this.drawCurve({width:radius},{width:radius});
						this.stroke.push(points[2]);
					}
					
				}
				if (points.length > 7) {
					// Draw to the temporary canvas
					this.clearTemp();
					var t1, t2, c = this.color;
/* 					this.color = "rgba(255,0,0"; */
					t1 = tangentForPoints(points[0], points[1], points[2], points[3], points[4]);
					t2 = tangentForPoints(points[1], points[2], points[3], points[4], points[5]);
					this.initializeCurve(t1, t2);
					this.drawCurve( points[2], points[3], this.tempContext);
					
					t1 = t2
					t2 = tangentForPoints(points[2], points[3], points[4], points[5], points[6]);
					this.initializeCurve(t1, t2);
					this.drawCurve( points[3], points[4], this.tempContext);
					
					t1 = t2
					t2 = tangentForPoints(points[3], points[4], points[5], points[6], points[7]);
					this.initializeCurve(t1, t2);
					this.drawCurve( points[4], points[5], this.tempContext);
					
/* 					this.color = "rgba(0,255,0"; */
					if (points.length > 8) {
/*
						t1 = t2
						t2 = tangentForPoints(points[4], points[5], points[6], points[7], points[8]);
						this.initializeCurve(t1, t2);
						this.drawCurve( points[5], points[6], this.tempContext);
*/
						this.drawLine(points[7], points[8], this.tempContext);
					}
/* 					else */
						this.drawLine(points[5], points[6], this.tempContext);
						
					this.drawLine(points[6], points[7], this.tempContext);
					
/* 					this.color = c; */
					
/*
					var radius = this.strokeRadius, color = this.color+",1)";
					with (this.tempContext) {
						lineWidth = radius;
						strokeStyle = color;
						beginPath();
						//moveTo(points[2].x, points[2].y);
						//lineTo(points[3].x, points[3].y);
						//lineTo(points[4].x, points[4].y);
						moveTo(points[5].x, points[5].y);
						lineTo(points[6].x, points[6].y);
						lineTo(points[7].x, points[7].y);
					}
					if (points.length==9)
						this.tempContext.lineTo(points[8].x, points[8].y);
					this.tempContext.stroke();
					this.tempContext.closePath();
*/
				}
				if (this.point !== undefined) {
					// Plot raw data. This was for debugging
					if (this.point) {
						with (this.context) {
							lineWidth = 1;
							strokeStyle = "green";
							beginPath();
							moveTo(this.point.x, this.point.y);
							lineTo(point.x, point.y);
							stroke();
							closePath();
/* 							fillStyle = "blue"; fillRect(point.x-2, point.y-3,6,6); */
						}
					}
					this.point = point;
				}
			}
			else {
				if (sender.state == JSGestureRecognizerStateEnded) {
					var points = vq.getPoints();
					if (points.length == 2) {
						this.drawLine(points[0], points[1]);
					}
					else if (points.length == 3) {
						vq.estimateInitialTangent();
						points = vq.getPoints(); // length should be 5
					}
					while (points.length > 5) {
						vq.calculateTangent();
						this.initializeCurve(vq.t1, vq.t2);
						this.drawCurve({width:radius},{width:radius});
						this.stroke.push(points[2]);
						points = vq.getPoints();
					}
					if (points.length == 5) {
						this.stroke.push(points[2],points[3],points[4]);
						vq.estimateEndPoints();
						vq.calculateTangent();
						this.initializeCurve(vq.t1, vq.t2);
						this.drawCurve({width:radius},{width:radius});
						vq.calculateTangent();
						this.initializeCurve(vq.t1, vq.t2);
						this.drawCurve({width:radius},{width:radius});
					}
					else if (points.length > 2)
						throw new Error("Internal error. points.length "+points.length+" should only be 1, 2 or 5.");
					
					this.addStrokeToDoc();
				}
				sender.dx=0;
				sender.dy=0;
				this.vq.reset();
				this.clearTemp();
				if (this.point !== undefined)
					this.point = null;
			}
		}
	};
	// From underscore.js
	this.bind = function(func, context) {
		if (Function.prototype.bind) return Function.prototype.bind.apply(func, Array.prototype.slice.call(arguments, 1));
		var args = slice.call(arguments, 2);
		return function() {
			return func.apply(context, args.concat(Array.prototype.slice.call(arguments)));
		};
	};
	this.panGestureCallback = this.bind(this.panGestureCallback, this);
	this.tapGestureCallback = this.bind(this.tapGestureCallback, this);
	
	this.ready = function() {
		var canvas = this.canvas = document.getElementById(this.id);
		var context = this.context = canvas.getContext("2d");
		this.tempContext = document.getElementById(this.id+"-temp").getContext("2d");
		context.globalCompositeOperation = "source-over";
		//Uncomment to plot raw data
/* 		this.point = null; */
		this.stroke = [];
		
		// Setup gesture recognizers
		var self = this;
		var gestureView = new JSGestureView(this.id+"-temp");
		var tapRecognizer = new JSTapGestureRecognizer();
		tapRecognizer.numberOfTapsRequired = 1;
		tapRecognizer.initWithCallback(this.tapGestureCallback);
		gestureView.addGestureRecognizer(tapRecognizer);
		var panRecognizer = new JSPanGestureRecognizer();
		panRecognizer.maximumNumberOfTouches = 1;
		panRecognizer.initWithCallback(this.panGestureCallback);
		gestureView.addGestureRecognizer(panRecognizer);
	};
	
	this.clear = function() {
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}
	
	this.clearTemp = function() {
		this.tempContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}
	
	this.clearDocument = function() {
		var newDoc = {drawDocumentVersion:_currentDocumentVersion};
		this.undoManager.register(
			this,this.setDocument,[this.currentDocument],"Undo clearDocument",
			this,this.setDocument,[newDoc],"Redo clearDocument"
		);
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.setDocument(newDoc);
	}
	
	this.undoManager = new UndoManager(this);
	this.undo = function () {
		this.undoManager.undo();
	};
	this.redo = function () {
		this.undoManager.redo();
	};
	
	this.setDocument = function(doc) {
		if (!doc || doc.drawDocumentVersion === undefined)
			throw new TypeError("invalid document");
		this.currentDocument = doc;
		this.clear();
		
		switch(doc.drawDocumentVersion) {
			case "1.0":
				var strokes = doc.strokes, thisColor = this.color;
				for (var i in strokes)
					this.processStroke(strokes[i]);
				this.color = thisColor;
				break;
			default:
				throw new TypeError("Unknown document version "+doc.drawDocumentVersion+". Current version: "+_currentDocumentVersion);
		}
	}
	if (options.document)
		this.setDocument(options.document);
	else
		this.currentDocument = {drawDocumentVersion:_currentDocumentVersion};
		
	this.loadDocument = function(doc) {
		this.undoManager.clear();
		this.setDocument(doc);
	};
	
	this.loadNewDocument = function() {
		this.undoManager.clear();
		this.setDocument({drawDocumentVersion:_currentDocumentVersion});
	};
	
	
	
}