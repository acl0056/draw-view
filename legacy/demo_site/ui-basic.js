/*	File: ui-basic.js
	Some useful basic ui objects modeled after Core Graphics
*/

/*	Class: Point
	A point has x and y properties and some methods for 2D vector math, including the application of a 2D transformation matrix.
	
	Properties:
		x - A numeric x value.
		y - A numeric y value.
*/
/*	Function: Point(x,y)
	Constructor
	
	Parameters:
		x - A numeric x value.
		y - A numeric y value.
*/
function Point(x,y) {
	if (isNaN(x) || isNaN(y))
		throw new TypeError("Arguments x and y must be numeric.");
	this.x = x;
	this.y = y;
	
	/*	Function: add(anotherPoint)
		Get the sum of two 2D vectors.
	
		Parameters:
			anotherPoint - A Point object.
			
		Returns:
			The vector sum as a new Point object.
	*/
	this.add = function(anotherPoint){
		if (!(anotherPoint && anotherPoint.x !== undefined && anotherPoint.y !== undefined))
			throw new TypeError("Argument must be an object with x and y properties.");
		return new Point(anotherPoint.x+this.x, anotherPoint.y+this.y);
	};

	/*	Function: distance(anotherPoint)
		Get B-A, where this is A.
		
		Parameters:
			anotherPoint - A Point object.
			
		Returns:
			A vector distance as a new Point object, or null if argument does not have x and y properties. Note that this is not a numeric Euclidean distance, but a difference vector.
	 */
	this.distance = function(anotherPoint){
		if (!(anotherPoint && anotherPoint.x !== undefined && anotherPoint.y !== undefined))
			throw new TypeError("Argument must be an object with x and y properties.");
		return new Point(anotherPoint.x-this.x, anotherPoint.y-this.y);
	};
	
	/*	Function: subtract(anotherPoint)
		Get A-B, where this is A.
	
		Parameters: 
			anotherPoint - A Point object.
			
		Returns: 
			The vector difference as a new Point object (this minus anotherPoint)
	*/
	this.subtract = function(anotherPoint){
		if (!(anotherPoint && anotherPoint.x !== undefined && anotherPoint.y !== undefined))
			throw new TypeError("Argument must be an object with x and y properties.");
		return new Point(this.x-anotherPoint.x, this.y-anotherPoint.y);
	};
	
	/*	Function: equals(anotherPoint)
		Check numeric equality of point properties.
		
	 	Parameters:
	 		anotherPoint - A Point object.
	 		
	 	Returns:
	 		boolean True if x and y are equal, otherwise false.
	*/
	this.equals = function(anotherPoint) {
		if (!(anotherPoint && anotherPoint.x !== undefined && anotherPoint.y !== undefined))
			throw new TypeError("Argument must be an object with x and y properties.");
		if (anotherPoint.x != this.x)
			return false;
		if (anotherPoint.y != this.y)
			return false;
		return true;
	};
	
	/*	Function: negative()
		Get the negative of this vector.
	
		Returns:
	 		The negative vector of this vector as a new Point object
	*/
	this.negative = function(){
		return new Point(-this.x, -this.y);
	};
	
	/*	Function: applyTransform(matrix)
		Apply a transformation matrix to this point.
		
		Parameters: 
	 		matrix - A MatrixArray object
	*/
	this.applyTransform = function(matrix) {
		if (!(matrix instanceof MatrixArray))
			throw new TypeError("Argument must be an instance or subclass of MatrixArray.");
		var vertex = new MatrixArray(1, 3, [this.x,this.y,1]);
		var result = vertex.multiply(matrix);
		this.x = result.pos[0][0];
		this.y = result.pos[0][1];
	};
};

/*	Class: Size
	A simple object with width and height properties.

	Properties:
		width - A numeric width value.
		height - A numeric height value.
*/
/*	Size(width, height)
	Constructor

	Parameters:
		width - A numeric width value.
		height - A numeric height value.
*/
function Size(width, height) {
	if (isNaN(width) || isNaN(height))
		throw new TypeError("Arguments width and height must be numeric.");
	this.width = width;
	this.height = height;
	
	/*	Function: equals(anotherSize)
		Check numeric equality of size properties.
		
		Parameters:
			anotherSize - A Size object.
		
		Returns: 
			Boolean, true if width and height are equal, otherwise false.
	*/
	this.equals = function(anotherSize) {
		if (!(anotherSize && anotherSize.width !== undefined && anotherSize.height !== undefined))
			throw new TypeError("Arguments must be an object with width and height properties.");
		if (anotherSize.width != this.width)
			return false;
		if (anotherSize.height != this.height)
			return false;
		return true;
	};
};

/*	Class: Line
	A simple line segment object, useful for checking the intersection of two 2D lines.

 	Properties:
 		p1 - A Point object start point.
 		p2 - A Point object end point.
*/
/*	Function: Line(p1,p2)
	Constructor
	
 	Parameters:
 		p1 - A Point object start point.
 		p2 - A Point object end point.
*/
function Line(p1,p2) {
	if (!(p1 && p1.x !== undefined && p1.y !== undefined) || !(p2 && p2.x !== undefined && p2.y !== undefined))
		throw new TypeError("Arguments must be objects that have x and y properties.");
	this.p1 = p1;
	this.p2 = p2;
	
	/*	Function: intersection(b)
		Find an itersection with a line.
		
	 	Parameters: 
	 		b - A Line object.
	 		
	 	Returns:
	 		A Point object for the intersection, or null if lines are parallel.
	 */
	this.intersection = function(b) {
		if (!(b instanceof Line))
			throw new TypeError("Argument must be a line or a point.");
		var x1=this.p1.x,x2=this.p2.x,x3=b.p1.x,x4=b.p2.x,
			y1=this.p1.y,y2=this.p2.y,y3=b.p1.y,y4=b.p2.y,
			x12 = x1-x2,x34 = x3-x4, y12 = y1-y2, y34 = y3-y4,
			xy12=x1*y2 - y1*x2,xy34 = x3*y4-y3*x4,
			den = x12*y34 - y12*x34;
		if (den == 0)
			return null;
		return new Point( (xy12*x34 - x12*xy34) /den, (xy12*y34 - y12*xy34) /den);
	}
};

/*	Class: Frame
	An object with origin and size properties. 

	Properties:
		origin - a Point object
		size - a Size object
*/
/* Function: Frame(origin, size)
	Constructor
	
	Parameters:
		origin - a Point object
		size - a Size object
*/
function Frame(origin, size) {
	if (! origin instanceof Point)
		throw new TypeError("Argument 0 must be a Point object");
	if (!size instanceof Size)
		throw new TypeError("Argument 1 must be a Size object");
	this.origin = origin;
	this.size = size;
	
	/*	Function: equals(anotherFrame)
		Check numeric equality of frame properties.
		
	 	Parameters:
	 		anotherFrame - A Frame object.
	 	
	 	Returns:
	 		boolean True if origin and size are equal, otherwise false.
	*/
	this.equals = function(anotherFrame) {
		if (! anotherFrame instanceof Frame)
			throw new TypeError("Argument must be a Frame object.");
		return (anotherFrame.origin.equals(this.origin) && anotherFrame.size.equals(this.size));
	};
	
	/*	Function: isPointInsideFrame(point)
		Check if a Point is inside of this Frame.
		
		Parameters:
			point - A Point object.
			
		Returns:
			True if the point is inside the frame, otherwise false.
	*/
	this.isPointInsideFrame = function(point) {
		if (!(point && point.x !== undefined && point.y !== undefined))
			throw new TypeError("Argument must be an object with x and y properties.");
		return (point.x>=this.origin.x&&point.x<=(this.origin.x+this.size.width)&&point.y>=this.origin.y&&point.y<=(this.origin.y+this.size.height));
	};
	
	/*	Function: copy()
		Duplicate this Frame object.
		
		Returns:
			A new Frame object with copies of this Frame object's prigin and size properties.
	*/
	this.copy = function(){
		var origin = new Point(this.origin.x,this.origin.y);
		var size = new Size(this.size.width,this.size.height);
		return new Frame(origin,size);
	};
	
	
};

/*	Function: Frame.make(x,y,w,h)
	A class method for quickly instantiating a frame object, without having to instantiate its origin and size property objects.
	
	Parameters:
		x - Numeric x coordinate value.
		y - Numeric x coordinate value.
		w - Numeric width value.
		h - Numeric height value.
		
	Returns:
		A new Frame instance.
*/
Frame.make = function(x,y,w,h) {
	var origin = new Point(x,y);
	var size = new Size(w,h);
	return new Frame(origin,size);
};

/* 	Class: MatrixArray
	This structure contains a two dimensional array that follows (row, col) notation where row i column j is matrix.pos[i][j]; The pos property name is short for position.
	
	Properties:
		rows - The number of rows in the matrix.
		columns - The number of columns in the matrix.
		pos - A two dimensional array that holds the matrix values.
*/
/*	Function: MatrixArray(rows, columns [, values])
	Constructor
	
	Parameters:
		rows - An integer value for the number of rows in the matrix.
		columns - An integer value for the number of columns in the matrix.
		values - An optional one dimensional array containing the values to populate the matrix.pos two dimensional array. If not given, pos will contain 0 through rows-1 empty arrays.
 */
function MatrixArray(rows, columns) {
	var values = null;
	if (arguments[2] !== undefined)
		values = arguments[2];

	this.rows = rows;
	this.columns = columns;
	this.objectType = "MatrixArray";
	this.setMatrix = function(valuesIn) {
		this.pos = [];
		var increment = 0;
		for (var i = 0; i<rows; i++) {
			this.pos[i] = [];
			for (var n = 0; n<columns; n++) {
				if (valuesIn[increment] === undefined) 
					throw new TypeError("Undefined value for row "+i+" column "+n+" for values passed into MatrixArray");
				this.pos[i][n] = valuesIn[increment];
				increment++;
			}
		}
	};
	
	if (values !== null)
		this.setMatrix(values);
	else {
		this.pos = [];
		for (var i = 0; i<rows; i++) {
			this.pos[i] = [];
		}
	}
	
	var detrm = function(a,k){
		var i,j,m,n,c,s=1,d=0,b=[];
		if(k==1)
			return a[0][0];
		else{
			for (i=0;i<k;i++)
				b[i] = [];
			for(c=0;c<k;c++){
				m=0;n=0;
				for(i=0;i<k;i++){
					for(j=0;j<k;j++){
						b[i][j]=0;
						if(i!=0&&j!=c){
							b[m][n]=a[i][j];
							if(n<(k-2))
								n++;
							else{
								n=0;m++;
							}
						}
					}
				}
				d=d+s*(a[0][c]*detrm(b,k-1));
				s=-1*s;
			}
		}
		return d;
	};
	
	/*	Function: determinant()
		Get the determinant of a matrix.
	
		Returns:
			The float determinant value.
	*/
	this.determinant = function() {
		if (this.rows != this.columns)
			throw new Error( "Error. Can only compute the determinant of n by n matrices.");
		return detrm(this.pos, this.rows);
	};
	
	/*	Function: inverse()
		Get the inverse of a matrix.
		
		Returns:
			A new MatrixArray that is the inverse of this MatrixArray object, or null if matrix is not invertable.
	*/
	this.inverse = function() {
		if (this.rows != this.columns)
			throw new Error( "Error. I only know how to compute the inverse of n by n matrices.");
		var d = this.determinant();
		if (d == 0)
			return null;
			
		var p,q,m,n,i,j,b=[],f=[],k=this.rows;
		function index(r,c){
			return r*k+c;
		}
		for(i=0;i<k;i++){b[i]=[];}
		for(q=0;q<k;q++){
			for(p=0;p<k;p++){
				m=0;n=0;
				for(i=0;i<k;i++ )
					for(j=0;j<k;j++){
						b[i][j]=0;
						if(i!=q&&j!=p){
							b[m][n]=this.pos[i][j];
							if(n<(k-2))
								n++;
							else{ n=0;m++; }
						}
					}
				f[index(q,p)] = Math.pow(-1,(q+p))*detrm(b,k-1);
			}
		}
		var result = [];
		n = 0;
		for(i=0;i<k;i++) {
			for(j=0;j<k;j++) {
				result[n] = f[index(j,i)]/d;
				n++;
			}
		}
	    return new MatrixArray(k,k,result);
	};

	/*	Function: getColumn(index [,raw])
		Get a column of a matrix.
		
		Parameters:
			index - An zero-indexed integer column number.
			raw - An optional boolean value. If true, return a simple one dimensional array. Default is false, which returns a MatrixArray object.
		
		Returns:
			An n by 1 MatrixArray object or an array if raw is true.
	*/
	this.getColumn = function (index) {
		var raw = false;
		if (arguments[1] !== undefined)
			raw = arguments[1];
		var column = [];
		for (var i = 0; i<this.rows; i++) {
			if (this.pos[i][index] === undefined)
				console.log("Error: undefined value for row "+i+" column "+index+" for values access in getColumn");
			column.push(this.pos[i][index]);
		}
		if (raw)
			return column;
		else
			return new MatrixArray(this.rows, 1, column);
	};	

	/*	Function: getRow(index [,raw])
		Get a row of a matrix
	
		Parameters:
			index - An zero-indexed integer column number.
			raw - An optional boolean value. If true, return a simple one dimensional array. Default is false, which returns a MatrixArray object.
			
		Returns:
			An 1 by n MatrixArray object or an array if raw is true.
	*/
	this.getRow = function (index) {
		var raw = false;
		if (arguments[1] !== undefined)
			raw = arguments[1];
		var row = [];
		for (var i = 0; i<this.columns; i++) {
			if (this.pos[index][i] === undefined)
				console.log("Error: undefined value for row "+index+" column "+i+" for values access in getRow");
			row.push(this.pos[index][i]);
		}
		if (raw)
			return row;
		else
			return new MatrixArray(1, this.columns, row);
	};

	/*	Function: multiply(matrix [,raw])
		Multiply this, an m by n matrix, by an n by p matrix, resulting in an m by p matrix.  Assert these dimensional constraints.
		Assume AB=C, where this is A and the input value is B. The order and orintation of A and B are important. 
		To multiply a scalar and a vector, the scalar must be A and the vector B must be a row vector, in order for A.columns to equal B.rows.
		To multiply a vector and a matrix, a row vector would be A, but a column vector would be B.
	
		Parameters:
			matrix - An n by p MartixArray object.
			raw - An optional boolean value. If true, return a simple one dimensional array. Default is false, which returns a MatrixArray object.
		
		Returns:
			An m by p matrix or raw array representation.
	*/
	this.multiply = function (matrix) {
		var raw = arguments[1]?arguments[1]:false;
		if (! matrix instanceof MatrixArray)
			throw new TypeError("matrix.multiply did not receive a MatrixArray object.");
		// If matrix A (this) is m by n then b must be n by p
		if (this.columns != matrix.rows)
			throw new TypeError("A columns != B rows in matrix.multiply");
		var	result = [], length = this.columns, a = this.pos, b = matrix.pos, increment = 0;
		for (var i = 0; i<this.rows; i++) {
			for (var j = 0; j<matrix.columns; j++) {
				var sum = 0;
				for (var k = 0; k<length; k++)
					sum += a[i][k]*matrix.pos[k][j];
				result[increment++] = sum;
			}
		}
		return raw?result:new MatrixArray(this.rows, matrix.columns, result);
	};

	/*	Function: equals()
		Parameters:
			m - Another MatrixArray object.
			
		Returns:
			True if the MatrixArray object has the same number of rows and columns and all values in the matrix are equal, otherwise false.
	*/
	this.equals = function(m) {
		if (this.rows != m.rows || this.columns != m.columns)
			return false;
		for (var row = 0; row<this.rows; row++)
			for (var col = 0; col<this.columns; col++)
				if (this.pos[row][col] != m.pos[row][col]) 
					return false;
		return true;
	};
	
	/*	Function: isIdentityMatrix()
		Returns:
			True if this MatrixArray object is an identity matrix, otherwise false.
	*/
	this.isIdentityMatrix = function() {
		var isId = true;
		for (var row = 0; row<this.rows; row++) {
			for (var col = 0; col<this.columns; col++) {
				isId = (this.pos[row][col] == (row == col?1:0) );
				if (!isId)
					break;
			}
			if (!isId)
				break;
		}
		return isId;
	};
};

/*	Function: MatrixArray.identityMatrix(n)
	Class method for instantiating an identity matrix.
	
	Parameters:
		n - An Integer value n, for creating an n by n identity matrix.
		
	Returns:
		A MatrixArray object that is an n by n identity matrix.
*/
MatrixArray.identityMatrix = function(n) {
	var array = [];
	for (var row = 0; row<n; row++) {
		for (var col = 0; col<n; col++) {
			array.push( (row == col?1:0) );
		}
	}
	return new MatrixArray(n, n, array);
};


/*	Class: Transform
	A matrix object that is used for 2D transformations.
	
	Superclass: 
		<MatrixArray>
*/
/*	Function: Transform(ax, ay, bx, by, tx, ty)
	Constructor
	
	Parameters:
		ax - 0,0
		ay - 0,1
		bx - 1,0
		by - 1,1
		tx - 2,0 Translates x
		ty - 2,1 Translates y
*/
function Transform(ax, ay, bx, by, tx, ty) {
	MatrixArray.call(this, 3, 3, [ax,ay,0,bx,by,0,tx,ty,1]);
	
	/*	Function: css()
		Returns:
			The string value for css: "matrix(ax,ay,bx,by,tx,ty)"
	*/
	this.css = function() {
		return "matrix("+this.pos[0][0].toFixed(16)
			+	","+this.pos[0][1].toFixed(16)
			+	","+this.pos[1][0].toFixed(16)
			+	","+this.pos[1][1].toFixed(16)
			+	","+this.pos[2][0].toFixed(16)
			+	","+this.pos[2][1].toFixed(16)+")"; 
	};
	/*	Function: applyToContext(ctx)
		Apply this Transform to an HTML 5 Canvas context.
		
		Parameters:
			ctx - A canvas context.
	*/
	this.applyToContext = function(ctx){
		ctx.transform(this.pos[0][0],this.pos[0][1],this.pos[1][0],this.pos[1][1],this.pos[2][0],this.pos[2][1]);
	};
	/*	Function: unapplyToContext(ctx)
		Apply the inverse of this Transform to an HTML 5 Canvas context.
		
		Parameters:
			ctx - A canvas context.
	*/
	this.unapplyToContext = function(ctx){
		var inv = this.inverse();
		ctx.transform(inv.pos[0][0],inv.pos[0][1],inv.pos[1][0],inv.pos[1][1],inv.pos[2][0],inv.pos[2][1]);
	};

	/*	Function: applyTransform(matrix)
		Apply a transformation matrix to this Transform.
		
		Parameters:
			matrix - Another MatrixArray object or subclass.
	*/
	this.applyTransform = function(matrix) {
		var result = this.multiply(matrix);
		this.pos = result.pos;
	};
	
	// override parent determinant() because finding the determinant of 3x3 can be done more efficiently here.
	this.determinant = function() {
		var returnValue = this.pos[0][0] * ( this.pos[1][1]*this.pos[2][2] - this.pos[2][1]*this.pos[1][2] );
		returnValue -= this.pos[0][1]*( this.pos[1][0]*this.pos[2][2] - this.pos[2][0]*this.pos[1][2] );
		returnValue += this.pos[0][2]*( this.pos[1][0]*this.pos[2][1] - this.pos[1][1]*this.pos[2][0] );
		return returnValue;
	};
};

Transform.prototype = MatrixArray.prototype;

/*	Function: Transform.rotationMatrix(theta [, inRadians])
	Class method for creating a counterclockwise rotation matrix.  Assumes degrees unless specified.
	
	Parameters:
		theta - An angle.
		inRadians - An optional boolean value. Set to true if you are passing in a radian value.
		
	Returns:
		A new counterclockwise rotation matrix.
*/
Transform.rotationMatrix = function(theta) {
	if (!arguments[1])
		theta = theta*(Math.PI/180);
	return new Transform(
		Math.cos(theta), Math.sin(theta),
		-Math.sin(theta), Math.cos(theta),
		0.0, 0.0
	);
};

/* Function: Transform.translationMatrix(vector)
	Class method for creating a translation matrix.
	
	Parameters:
		vector - An object with x an y properties.
	
	Returns:
		A translation matrix.
*/
Transform.translationMatrix = function(vector) {
	if (!(vector && vector.x !== undefined && vector.y !== undefined))
		throw new TypeError("Argument must be an object with x and y properties.");
	return new Transform(1,0,0,1,vector.x,vector.y);
};

/*	Function: Transform.scaleMatrix(scalar)
	Class method for creating a scale matrix.
	
	Parameters:
		scalar - A vector with x and y scalar values.
*/
Transform.scaleMatrix = function(scalar){
	if (scalar.x !== undefined && scalar.y !== undefined)
		return new Transform(scalar.x,0,0,scalar.y,0,0);
	if (isNaN(scalar))
		throw new TypeError("scalar was not a number and did not have x and y properties.");
	return new Transform(scalar,0,0,scalar,0,0);
};

/* 	Function: Transform.identityMatrix()
	Class method for identity matrix.
	
	Returns:
		A 3x3 identity matrix as a Transform object.
*/
Transform.identityMatrix = function() {
	return new Transform(1,0,0,1,0,0);
};