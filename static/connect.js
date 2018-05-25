/*Client side script Chat App*/
$(document).ready(function() {
	/*
	TODO: Add listeners for drawing to erase fully.

	*/
	var $drawingArea = $('.drawingSVG');
	var $chatSendBtn = $('button#btn-chat');
	var $chatInput = $('#chat-input');
	var $nameInput = $('.name');
	var $clearAllBtn = $('.clear-all');
	var $usersList = $('#users');
	var $nameSubmitBtn = $('button.entername');
	var $chatList = $(".chat");
	var $nametext = $('.dname');
	var $penTool = $('.pen-tool');
	var $pencilTool = $('.pencil-tool');
	var $eraserTool = $('.eraser-tool');
	var $lineTool = $('.line-tool');
	var $rectTool = $('.rectangle-tool');
	var $ellipseTool = $('.ellipse-tool');
	var $selfView = $('#selfView');
	var $sendVideoBtn = $('.sendVideoBtn');
	var $videoCanvas = $('.videoCanvas');

	var socket = io();
	console.log(socket);

	var myName;
	var activeTool = 'pen';
	$drawingArea.css( 'cursor', 'url(/pen3.cur), auto');

	var utilityHelper={
		getEllipseCenter: function(start, end){
			return {
				x: (start.x+end.x)/2,
				y: (start.y+end.y)/2
			}
		},
		getEllipseHorizontalRadius: function(start, end){
			return (end.x-start.x)/2;
		},
		getEllipseVerticalRadius: function(start, end){
			return (end.y-start.y)/2;
		},
		getCommonSVGStyle: function(e){
			var stroke_style="", stroke_color="", stroke_width='stroke-width:4px;', svgElStyle;

			if(e.which === 3){
				stroke_color = 'stroke:red;';
			}
			else{
				stroke_color = 'stroke:white;';
			}

			switch(activeTool){
				case 'pen':
					//Default settings
				break;
				case 'pencil':
					stroke_style = "stroke-dasharray:5,5;";
				break;
				case 'eraser':
					stroke_color = 'stroke:black;';
					stroke_width = 'stroke-width:20px;';
				break;
				default:
				break;
			}

			svgElStyle = 'fill:none;' + stroke_color + stroke_width + stroke_style;
			return svgElStyle;
		}
	}

	var lineTool={
		svgEl: null,
		lineStart: {},
		getElement: function(e){
			this.svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');

			var svgElProperties = utilityHelper.getCommonSVGStyle(e);
			var svgAttr = {x1:e.offsetX, y1:e.offsetY, x2:e.offsetX, y2:e.offsetY, style:svgElProperties};

			$(this.svgEl).attr(svgAttr);
			this.lineStart.x = e.offsetX;
			this.lineStart.y = e.offsetY;
			
			$drawingArea.append(this.svgEl);
			socket.emit('cursorStart', {type:'line', attributes:svgAttr});
			return this.svgEl;
		},
		addDrawing: function (){
			if(this.svgEl){
				var style = this.svgEl.getAttribute('style');
				var x1 = this.svgEl.getAttribute('x1');
				var y1 = this.svgEl.getAttribute('y1');
				var x2 = this.svgEl.getAttribute('x2');
				var y2 = this.svgEl.getAttribute('y2');
				socket.emit('addDrawing', {type:'line', attributes:{x1:x1, y1:y1, x2:x2, y2:y2, style:style}});
				//Remove the current drawn drawing as socket broadcasted drawing will be replaced with it
				$(this.svgEl).remove();
			}
		},
		updateElement: function(e){
			var svgAttr = null;
			svgAttr = {x1:this.lineStart.x, y1:this.lineStart.y, x2:e.offsetX, y2:e.offsetY};
			$(this.svgEl).attr(svgAttr);
			socket.emit('updateCursor', {type:'line', posAttrs:svgAttr});
		}
	}

	var penTool={
		svgEl: null,
		points: [],
		getElement: function(e){
			this.svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');

			var svgElStyle = utilityHelper.getCommonSVGStyle(e);
			var svgElAttr = {'style':svgElStyle, 'd':null};
			$(this.svgEl).attr(svgElAttr);
			var x,y;
			if(e.originalEvent.touches){
				x = e.originalEvent.touches[0].pageX;
				y = e.originalEvent.touches[0].pageY;
			}
			else{
				x = e.offsetX;
				y = e.offsetY;	
			}
			this.points.push({x:x, y:y});
			socket.emit('cursorStart', {type:'path', attributes:svgElAttr});
			return this.svgEl;
		},
		addDrawing: function (){
			if(this.points.length > 1){
				this.points = simplify(this.points, 1, true);
				this.svgEl.setAttribute('d', helper.path.getSVGPath(this.points));
				var style = this.svgEl.getAttribute('style');
				var d = this.svgEl.getAttribute('d');
				//TODO: d transmitted is in the format of SVG and not points array. Decide on strategy
				socket.emit('addDrawing', {type:'path', attributes:{style:style, d:d}});
				$(this.svgEl).remove();
			}
			this.points=[];
		},
		updateElement: function(e){
			var x,y;
			var rect = e.target.getBoundingClientRect();
			if(e.originalEvent.touches){
				x = e.originalEvent.touches[0].pageX - rect.left;
				y = e.originalEvent.touches[0].pageY - rect.top;
			}
			else{
				x = e.offsetX;
				y = e.offsetY;	
			}
			this.points.push({x:x, y:y});
			this.svgEl.setAttribute('d', helper.path.getSVGPath(this.points));
			socket.emit('updateCursor', {type:'path', points:this.points});
		}
	}

	var rectTool = {
		svgEl: null,
		rectStart: {},
		getElement: function(e){
			this.svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			
			var svgElStyle = utilityHelper.getCommonSVGStyle(e);
			var svgAttr = {x:e.offsetX, y:e.offsetY, width:1, height:1, style:svgElStyle};
			$(this.svgEl).attr(svgAttr);
			this.rectStart.x = e.offsetX;
			this.rectStart.y = e.offsetY;
			
			$drawingArea.append(this.svgEl);
			socket.emit('cursorStart', {type:'rect', attributes:svgAttr});
			return this.svgEl;
		},
		addDrawing: function (){
			if(this.svgEl){
				var style = this.svgEl.getAttribute('style');
				var x = this.svgEl.getAttribute('x');
				var y = this.svgEl.getAttribute('y');
				var width = this.svgEl.getAttribute('width');
				var height = this.svgEl.getAttribute('height');
				socket.emit('addDrawing', {type:'rect', attributes:{x:x, y:y, width:width, height:height, style:style}});
				$(this.svgEl).remove();
			}
		},
		updateElement: function(e){
			var svgAttr = null;
			if(this.rectStart.x < e.offsetX && this.rectStart.y < e.offsetY){
				svgAttr = {x:this.rectStart.x, y:this.rectStart.y, width:e.offsetX-this.rectStart.x, height:e.offsetY-this.rectStart.y};
				
			}
			else if(this.rectStart.x < e.offsetX && this.rectStart.y > e.offsetY){
				svgAttr = {x:this.rectStart.x, y:e.offsetY, width:e.offsetX-this.rectStart.x, height:this.rectStart.y-e.offsetY};
			}
			else if(this.rectStart.x > e.offsetX && this.rectStart.y < e.offsetY){
				svgAttr = {x:e.offsetX, y:this.rectStart.y, width:this.rectStart.x-e.offsetX, height:e.offsetY-this.rectStart.y};
			}
			else if(this.rectStart.x > e.offsetX && this.rectStart.y > e.offsetY){
				svgAttr = {x:e.offsetX, y:e.offsetY, width:this.rectStart.x-e.offsetX, height:this.rectStart.y-e.offsetY};
			}
			else{
				svgAttr = {x:e.offsetX, y:e.offsetY, width:1, height:1};
			}
			$(this.svgEl).attr(svgAttr);
			socket.emit('updateCursor', {type:'rect', posAttrs:svgAttr});
		}
	}

	var ellipseTool = {
		svgEl: null,
		ellipseStart: {},
		getElement: function(e){
			this.svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');

			var svgElStyle = utilityHelper.getCommonSVGStyle(e);
			var svgAttr = {cx:e.offsetX, cy:e.offsetY, rx:1, ry:1, style:svgElStyle};
			$(this.svgEl).attr(svgAttr);
			this.ellipseStart.x = e.offsetX;
			this.ellipseStart.y = e.offsetY;
			
			$drawingArea.append(this.svgEl);
			socket.emit('cursorStart', {type:'ellipse', attributes:svgAttr});
			return this.svgEl;
		},
		addDrawing: function (){
			if(this.svgEl){
				var style = this.svgEl.getAttribute('style');
				var cx = this.svgEl.getAttribute('cx');
				var cy = this.svgEl.getAttribute('cy');
				var rx = this.svgEl.getAttribute('rx');
				var ry = this.svgEl.getAttribute('ry');
				socket.emit('addDrawing', {type:'ellipse', attributes:{x:cx, y:cy, rx:rx, ry:ry, style:style}});
				$(this.svgEl).remove();
			}
		},
		updateElement: function(e){
			var svgAttr = null;
			var x = e.offsetX;
			var y = e.offsetY;
			var sx = this.ellipseStart.x;
			var sy = this.ellipseStart.y;
			if(sx < x && sy < y){
				var center = utilityHelper.getEllipseCenter({x:x,y:y}, {x:sx, y:sy});
				var rx = utilityHelper.getEllipseHorizontalRadius({x:sx},{x:x});
				var ry = utilityHelper.getEllipseVerticalRadius({y:sy},{y:y});
				svgAttr = {cx:center.x, cy:center.y, rx:rx, ry:ry};
			}
			else if(sx < x && sy > y){
				var center = utilityHelper.getEllipseCenter({x:x,y:y}, {x:sx, y:sy});
				var rx = utilityHelper.getEllipseHorizontalRadius({x:sx},{x:x});
				var ry = utilityHelper.getEllipseVerticalRadius({y:y},{y:sy});
				svgAttr = {cx:center.x, cy:center.y, rx:rx, ry:ry};
			}
			else if(sx > x && sy < y){
				var center = utilityHelper.getEllipseCenter({x:x,y:y}, {x:sx, y:sy});
				var rx = utilityHelper.getEllipseHorizontalRadius({x:x},{x:sx});
				var ry = utilityHelper.getEllipseVerticalRadius({y:sy},{y:y});
				svgAttr = {cx:center.x, cy:center.y, rx:rx, ry:ry};
			}
			else if(sx > x && sy > y){
				var center = utilityHelper.getEllipseCenter({x:x,y:y}, {x:sx, y:sy});
				var rx = utilityHelper.getEllipseHorizontalRadius({x:x},{x:sx});
				var ry = utilityHelper.getEllipseVerticalRadius({y:y},{y:sy});
				svgAttr = {cx:center.x, cy:center.y, rx:rx, ry:ry};
			}
			else{
				svgAttr = {cx:x, cy:y, rx:1, ry:1};
			}
			$(this.svgEl).attr(svgAttr);
			socket.emit('updateCursor', {type:'ellipse', posAttrs:svgAttr});
		}
	}

	var genericListener = {
		penDown: false,		
		bindGenericEvents: function(){
			var self=this;
			$drawingArea.off();

			$drawingArea.on('contextmenu', function(e){
				e.preventDefault();
			});

			$drawingArea.on('mousedown touchstart', function(e){
				e.preventDefault();
				self.penDown = true;				
				switch(activeTool){
					case 'pen':
					case 'pencil':
					case 'eraser':
						var svgEl = penTool.getElement(e);
						$drawingArea.append(svgEl);
					break;
					case 'line':
						var svgEl = lineTool.getElement(e);
						$drawingArea.append(svgEl);
					break;
					case 'rect':
						var svgEl = rectTool.getElement(e);
						$drawingArea.append(svgEl);
					break;
					case 'ellipse':
						var svgEl = ellipseTool.getElement(e);
						$drawingArea.append(svgEl);
					break;
				}
			});

			$drawingArea.on('mousemove touchmove', function(e){
				if(self.penDown){
					e.preventDefault();
					switch(activeTool){
						case 'pen':
						case 'pencil':
						case 'eraser':
							penTool.updateElement(e);
						break;
						case 'line':
							lineTool.updateElement(e);
						break;
						case 'rect':
							rectTool.updateElement(e);
						break;
						case 'ellipse':
							ellipseTool.updateElement(e);
						break;
					}
				}
			}); 

			$drawingArea.on('mouseup touchend', function(e){
				if(self.penDown){
					e.preventDefault();
					switch(activeTool){
						case 'pen':
						case 'pencil':
						case 'eraser':
							penTool.addDrawing();
						break;
						case 'line':
							lineTool.addDrawing();
						break;
						case 'rect':
							rectTool.addDrawing();
						break;
						case 'ellipse':
							ellipseTool.addDrawing();
						break;
					}
					self.penDown = false;					
				}
			});

			$drawingArea.mouseleave(function(e){
				if(self.penDown){
					switch(activeTool){
						case 'pen':
						case 'pencil':
						case 'eraser':
							penTool.addDrawing();
						break;
						case 'line':
							lineTool.addDrawing();
						break;
						case 'rect':
							rectTool.addDrawing();
						break;
						case 'ellipse':
							ellipseTool.addDrawing();
						break;
					}
					self.penDown = false;
				}
			});
		}
	}

	var helper = {
		cursors: {},
		toolTips: {},
		init : function(){
			socket.emit('room id', window.location.href);
			setInterval(helper.updateLi, 30000);
			genericListener.bindGenericEvents();
			eventHandler.bindVideoEvents();
			eventHandler.bindToolBarEvents();
			eventHandler.bindChatEvents();
			eventHandler.bindSocketEvents();
		},
		showTooltip: function(name, position){
			if(!(name === myName || name === "/#"+socket.id)){
				if(helper.toolTips[name]){
					$(helper.toolTips[name]).attr({x:position.x, y:position.y});
				}
				else{
					helper.toolTips[name] = document.createElementNS('http://www.w3.org/2000/svg', 'text');
					$(helper.toolTips[name]).attr({x:position.x, y:position.y, style:'stroke:red;'});
					helper.toolTips[name].textContent = name;
					$drawingArea.append(helper.toolTips[name]);
				}
			}
		},
		removeToolTip: function(name){
			if(helper.toolTips[name]){
				$(helper.toolTips[name]).remove();
				delete helper.toolTips[name];
			}
		},
		rect: {
			cursorSvgEl: null,
			CursorStart: function(msg){
				this.cursorSvgEl = document.createElementNS('http://www.w3.org/2000/svg', msg.drawingData.type);
				$(this.cursorSvgEl).attr({
					style: msg.drawingData.attributes.style,
					x: msg.drawingData.attributes.x,
					y: msg.drawingData.attributes.y,
					width: msg.drawingData.attributes.width,
					height: msg.drawingData.attributes.height
				});
				helper.cursors[msg.name] = $(this.cursorSvgEl);
				$drawingArea.append(helper.cursors[msg.name]);
			},
			UpdateCursor: function(msg){
				var posAttrs = msg.drawingData.posAttrs;
				helper.cursors[msg.name].attr(posAttrs);
				helper.showTooltip(msg.name, {x:posAttrs.x, y:posAttrs.y});
			},
			AddDrawing: function(msg){
				if(helper.cursors[msg.name]){
					helper.cursors[msg.name].remove();
					delete helper.cursors[msg.name];
				}
				helper.removeToolTip(msg.name);
				var attrs = msg.drawingData.attributes;
				var el = document.createElementNS('http://www.w3.org/2000/svg', msg.drawingData.type);
				$(el).attr({
					style:attrs.style,
					x:attrs.x,
					y:attrs.y,
					width:attrs.width,
					height: attrs.height
				});
				$drawingArea.append(el);
			}
		},
		line: {
			cursorSvgEl: null,
			CursorStart: function(msg){
				this.cursorSvgEl = document.createElementNS('http://www.w3.org/2000/svg', msg.drawingData.type);
				$(this.cursorSvgEl).attr({
					style: msg.drawingData.attributes.style,
					x1: msg.drawingData.attributes.x1,
					y1: msg.drawingData.attributes.y1,
					x2: msg.drawingData.attributes.x2,
					y2: msg.drawingData.attributes.y2
				});
				helper.cursors[msg.name] = $(this.cursorSvgEl);
				$drawingArea.append(helper.cursors[msg.name]);
			},
			UpdateCursor: function(msg){
				var posAttrs = msg.drawingData.posAttrs;
				helper.cursors[msg.name].attr(posAttrs);
				helper.showTooltip(msg.name, {x:posAttrs.x2, y:posAttrs.y2});
			},
			AddDrawing: function(msg){
				if(helper.cursors[msg.name]){
					helper.cursors[msg.name].remove();
					delete helper.cursors[msg.name];
				}
				helper.removeToolTip(msg.name);
				var attrs = msg.drawingData.attributes;
				var el = document.createElementNS('http://www.w3.org/2000/svg', msg.drawingData.type);
				$(el).attr({
					style:attrs.style,
					x1:attrs.x1,
					y1:attrs.y1,
					x2:attrs.x2,
					y2: attrs.y2
				});
				$drawingArea.append(el);
			}
		},
		ellipse: {
			cursorSvgEl: null,
			CursorStart: function(msg){
				this.cursorSvgEl = document.createElementNS('http://www.w3.org/2000/svg', msg.drawingData.type);
				$(this.cursorSvgEl).attr({
					style: msg.drawingData.attributes.style,
					cx: msg.drawingData.attributes.x,
					cy: msg.drawingData.attributes.y,
					rx: msg.drawingData.attributes.rx,
					ry: msg.drawingData.attributes.ry
				});
				helper.cursors[msg.name] = $(this.cursorSvgEl);
				$drawingArea.append(helper.cursors[msg.name]);
			},
			UpdateCursor: function(msg){
				var posAttrs = msg.drawingData.posAttrs;
				helper.cursors[msg.name].attr(posAttrs);
				helper.showTooltip(msg.name, {x:posAttrs.cx, y:posAttrs.cy});
			},
			AddDrawing: function(msg){
				if(helper.cursors[msg.name]){
					helper.cursors[msg.name].remove();
					delete helper.cursors[msg.name];
				}
				helper.removeToolTip(msg.name);
				var attrs = msg.drawingData.attributes;
				var el = document.createElementNS('http://www.w3.org/2000/svg', msg.drawingData.type);
				$(el).attr({
					style:attrs.style,
					cx:attrs.x,
					cy:attrs.y,
					rx:attrs.rx,
					ry:attrs.ry
				});
				$drawingArea.append(el);
			}
		},
		path: {
			cursorSvgEl: null,
			getSVGPath: function(rawPoints){
				var svgPath = 'M '+rawPoints[0].x+' '+rawPoints[0].y;
				var len = rawPoints.length;
				for(var i=1; i<len; i++){
					svgPath = svgPath + ' L' + rawPoints[i].x + ' ' + rawPoints[i].y;
				}
				return svgPath;
			},
			CursorStart: function(msg){
				this.cursorSvgEl = document.createElementNS('http://www.w3.org/2000/svg', msg.drawingData.type);
				$(this.cursorSvgEl).attr({style:msg.drawingData.attributes.style});
				helper.cursors[msg.name] = $(this.cursorSvgEl);
				$drawingArea.append(helper.cursors[msg.name]);
			},
			UpdateCursor: function(msg){
				var rawPoints = msg.drawingData.points;
				var cursorPoints = this.getSVGPath(rawPoints);
				helper.cursors[msg.name].attr('d', cursorPoints);
				helper.showTooltip(msg.name, rawPoints[rawPoints.length-1]);
			},
			AddDrawing: function(msg){
				if(helper.cursors[msg.name]){
					helper.cursors[msg.name].remove();
					delete helper.cursors[msg.name];
				}
				helper.removeToolTip(msg.name);
				var attrs = msg.drawingData.attributes;
				var el = document.createElementNS('http://www.w3.org/2000/svg', msg.drawingData.type);
				$(el).attr({d:attrs.d, style:attrs.style});
				$drawingArea.append(el);
			}
		},
		createChatMsg: function(msg){
			var timeS = moment(msg.time).fromNow();
			var li;
			if(msg.name === myName || msg.name === "/#"+socket.id){
				li = "<li class='right clearfix'><p class='hidden'>"+msg.time+"</p><div class='chat-body clearfix'><div class='header'>"+
				"<small class='text-muted'><span class='glyphicon glyphicon-time'></span>"+timeS+"</small>"+
				"<strong class='pull-right primary-font'>"+msg.name+"</strong></div><p class='pull-right'>"+msg.data+"</p></div></li>";
			}
			else{
				li = "<li class='left clearfix'><p class='hidden'>"+msg.time+"</p><div class='chat-body clearfix'><div class='header'>"+
				"<strong class='primary-font'>"+msg.name+"</strong> <small class='pull-right text-muted'>"+
				"<span class='glyphicon glyphicon-time'></span>A few seconds ago</small></div><p>"+msg.data+"</p></div></li>";
			}
			return li;
		},
		updateLi: function(){
			var listItems = $(".chat li");
			listItems.each(function(idx, li) {
	    		var product = $(li);
	    		var textToSet = product.find('p.hidden').text();
	    		textToSet = moment(textToSet).fromNow();
	    		product.find('small.text-muted').text(textToSet);
			});
		},
		toggleActiveClass: function(target, className){
			if(!target.hasClass(className)) {
	            $('.tool-container').find("."+className).removeClass(className);
	            target.addClass(className);
	            return true;
	        }
	        return false;
		}
	};

	var eventHandler = {
		/*Bind drawing events again only if there is change in group.
		* Group1: pen,pencil,eraser
		* Group2: rectangle, ellipse
		* Group3: To be added
		*/
		bindToolBarEvents: function(){
			$penTool.click(function(e){
				helper.toggleActiveClass($penTool, "enabled");
				$drawingArea.css( 'cursor', 'url(/pen3.cur), auto');
				activeTool = 'pen';
			});

			$pencilTool.click(function(e){
				helper.toggleActiveClass($pencilTool, "enabled");
				$drawingArea.css( 'cursor', 'url(/pen3.cur), auto');				
				activeTool = 'pencil';
			});

			$eraserTool.click(function(e){
				helper.toggleActiveClass($eraserTool, "enabled");							
				activeTool = 'eraser';
			});

			$lineTool.click(function(e){
				helper.toggleActiveClass($lineTool, "enabled");
				$drawingArea.css( 'cursor', 'crosshair');				
				activeTool = 'line';
			});

			$rectTool.click(function(e){
				helper.toggleActiveClass($rectTool, "enabled");
				$drawingArea.css( 'cursor', 'crosshair');
				activeTool = 'rect';
			});

			$ellipseTool.click(function(e){
				helper.toggleActiveClass($ellipseTool, "enabled");
				$drawingArea.css( 'cursor', 'crosshair');
				activeTool = 'ellipse';
			});
		},
		bindVideoEvents: function(){
			var videoCanvasCtx = $videoCanvas.get(0).getContext("2d");
			$sendVideoBtn.click(function(){
				navigator.getUserMedia = (navigator.getUserMedia ||
                       navigator.webkitGetUserMedia ||
                       navigator.mozGetUserMedia ||
                       navigator.msGetUserMedia
                );
				navigator.getUserMedia({
				        video: true,
				        audio: false
				    },
				    function (localMediaStream) {
				        var $video = $('video');
				        $video.on('loadstart', function () {
				            //$video.play();
				            var videoEl = $video.get(0);
				            $videoCanvas.get(0).width  = videoEl.clientWidth;
							$videoCanvas.get(0).height = videoEl.clientHeight;
							setInterval(function(){
								videoCanvasCtx.drawImage(videoEl, 0, 0, $videoCanvas.get(0).width, $videoCanvas.get(0).height);
								//var video_data = videoCanvasCtx.getImageData(0, 0, $videoCanvas.get(0).width, $videoCanvas.get(0).height);
								socket.emit("video data", $videoCanvas.get(0).toDataURL());
							},200);
				        });
				        $video.prop('src', URL.createObjectURL(localMediaStream));
				    },
				    function (err) {
				        alert('webCam not accessible : '+err.name);
				    }
				);
			});
			socket.on("video data", function(msg){
				var canvas = $videoCanvas.get(0);
				if(!(msg.name === myName || msg.name === "/#"+socket.id)){
					var img = new Image();
				    img.onload = function() {
				        canvas.width = img.width;
				        canvas.height = img.height;
				        canvas.getContext("2d").drawImage(img, 0, 0);
				    };
				    img.src = msg.videoData;
				}
			});
		},
		bindChatEvents: function(){
			$chatSendBtn.click(function(){
				if($chatInput.val() !== ''){
					socket.emit('chat message', $chatInput.val().trim());
				}
				$chatInput.val('');
			});

			$chatInput.keypress(function(e){
				if(e.which === 13){
					$chatSendBtn.click();
				}
			});

			$nameSubmitBtn.click(function(){
				socket.emit('submit name', $nameInput.val());
				myName = $nameInput.val();
				$nametext.text($nameInput.val());
			});

			$nameInput.keypress(function(e){
				if(e.which === 13){
					$nameSubmitBtn.click();
				}
			});

			$clearAllBtn.click(function(){
				socket.emit('clearAll');
			});
		},
		bindSocketEvents: function(){
			socket.on('cursorStart', function(msg){
				helper[msg.drawingData.type].CursorStart(msg);
			});

			socket.on('updateCursor', function(msg){
				helper[msg.drawingData.type].UpdateCursor(msg);
			});

			socket.on('addDrawing', function(msg){
				helper[msg.drawingData.type].AddDrawing(msg);
				//Code for drawing listener events
				/*var newCursorSvgEl;
				$(cursorSvgEl).mouseover(function(){
					newCursorSvgEl=cursorSvgEl.cloneNode(true);
			 		newCursorSvgEl.id="newPawn1";
					var move="translate("+0+","+30+")";
					//newCursorSvgEl.setAttribute('style', 'fill:none; stroke:red; stroke-width:2px; ');
					newCursorSvgEl.setAttribute('style', 'fill:none; stroke:red; stroke-opacity:0.5; stroke-width:40px;');
					//$(newCursorSvgEl).attr({"stroke-opacity":"0.5", "stroke-width":"4px"});
					//newCursorSvgEl.setAttribute("transform",move);
					$drawingArea.append(newCursorSvgEl);
				});

				$(cursorSvgEl).mouseout(function(){
					$(newCursorSvgEl).remove();
				});*/
			});

			socket.on('clearAll', function(){
				$drawingArea.empty();
			});

			socket.on('users', function(msg){
				console.log(msg);
				$usersList.empty();
				$.each( msg, function( key, data ) {
					if(data.name){
						$usersList.append($('<li>').text(data.name));
					}
					else{
						$usersList.append($('<li>').text(key));
					}
				});
			});

			socket.on('initDrawings', function(drawings){
				var i = 0;
				for(i=0; i<drawings.length; i++){
					helper[drawings[i].drawingData.type].AddDrawing(drawings[i]);
				}
			});

			socket.on('chat message', function(msg){
				var li = helper.createChatMsg(msg);
				$chatList.append(li);
			});
		}
	};

	helper.init();
});