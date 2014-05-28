(function(global, undefined){

	'use strict';

	/**
	*  Responsible for handling the dynamic theme changing
	*  @class FlashExtension
	*  @constructor
	*  @param {String} stylesheet The selector for the style sheet
	*/
	var FlashExtension = function(stylesheet)
	{
		/**
		*  The stylesheet element
		*  @property {DOM} stylesheet
		*  @private
		*/
		this.stylesheet = $(stylesheet)[0];

		/**
		*  The Adobe app interface 
		*  @property {CSInterface} csInterface
		*/
		this.csInterface = new CSInterface(); 

		/**
		*  If the extension is supported in the context
		*  @property {Boolean} supported
		*  @readOnly
		*/
		this.supported = (global.__adobe_cep__ !== undefined);

		// Check that we can run
		if (!this.supported)
		{
			throw "Extension must run within Flash";
			return;
		}

		var self = this;

		// Update the color of the panel when the theme color of the product changed.
		this.csInterface.addEventListener(CSInterface.THEME_COLOR_CHANGED_EVENT, function(){

			// Should get a latest HostEnvironment object from application.
			var skinInfo = JSON.parse(global.__adobe_cep__.getHostEnvironment()).appSkinInfo;

			// Gets the style information such as color info from the skinInfo, 
			// and redraw all UI controls of your extension according to the style info.
			self.update(skinInfo);
		});

		// Update the theme right now
		this.update(this.csInterface.hostEnvironment.appSkinInfo);
		
		// Initialize
		this.init();
	};

	// Reference to the prototype
	var p = FlashExtension.prototype = {};

	/**
	*  The name of the plugin
	*  @property {String} name
	*/
	p.name = null;

	/**
	 * Initialize the extension, this is implementation specific
	 * @method init
	 */
	p.init = function()
	{
		// Extend something here
	};
	
	/**
	*  Toggle the theme to something else
	*  @method update
	*  @private
	*  @param {Object} info The App Skin Info from the application interface
	*/
	p.update = function(info)
	{		
		// Get the background color
		var color = info.panelBackgroundColor.color;
		
		this.addRule(
			"body", 
			"color: " + reverseColor(color) + ";"
				+ "font-size:" + info.baseFontSize + "px;"
				+ "background-color:"+ colorToHex(color)
		);
	};

	/**
	*  Save the settings
	*  @method saveSettings
	*  @param {*} settings The settings object
	*/
	p.saveSettings = function(value)
	{
		if (!this.name)
		{
			throw 'The name property must be set before saving settings';
		}

		value = value || "";

		if (typeof value != "object")
		{
			value = {
				"value" : value,
				"_isBasic" : true
			};
		}
		// Save the settings file, escape the quotes
		value = JSON.stringify(value).replace(/\"/g, '\\"');

		// Save the file
		this.execute('FLfile.write(fl.configURI + "' + this.name + '.json", "' + value + '");');
	};

	/**
	*  Load the settings
	*  @method loadSettings
	*  @param {Function} callback The callback which return the settings as the only argument
	*/
	p.loadSettings = function(callback)
	{
		if (!this.name)
		{
			throw 'The name property must be set before loading settings';
		}
		this.execute(
			'(function(){'
				+ ' return FLfile.read(fl.configURI + "' + this.name + '.json");'
				+ '}());',
			function(result)
			{
				if (result && result._isBasic)
				{
					result = result.value;
				}
				callback.call(this, result);
			}
		);
	};

	/**
	*  Add a rule to the style sheet
	*  @method addRule
	*  @param {String} selector The CSS selector
	*  @param {String} rule The CSS rules
	*/
	p.addRule = function(selector, rule)
	{
		var sheet = this.stylesheet.sheet;

		if (sheet.addRule)
		{
			sheet.addRule(selector, rule);
		} 
		else if (sheet.insertRule)
		{
			sheet.insertRule(selector + ' { ' + rule + ' }', sheet.cssRules.length);
		}
	};

	/**
	*  Reverse a color
	*  @method reverseColor
	*  @private
	*  @param {int} color The color to reverse
	*  @param {Number} delta The amount to reverse by
	*  @return {String}  The hexidecimal color (e.g. "#ffffff")
	*/ 
	var reverseColor = function(color, delta)
	{
		return colorToHex(
			{
				"red" : Math.abs(255 - color.red), 
				"green" : Math.abs(255 - color.green), 
				"blue" : Math.abs(255 - color.blue)
			}, 
			delta
		);
	};

	/**
	*  Convert the Color object to string in hexadecimal format;
	*  @method colorToHex
	*  @private
	*  @param {Object} color The color to select
	*  @param {int} color.red The red color value
	*  @param {int} color.blue The blue color value
	*  @param {int} color.green The green color value
	*  @param {Number} delta The color shift
	*  @return {String} The hexidecimal number (e.g. "#ffffff")
	*/
	var colorToHex = function(color, delta)
	{
		return "#" + valueToHex(color.red, delta) 
		 	+ valueToHex(color.green, delta) 
		 	+ valueToHex(color.blue, delta);
	};

	/**
	*  Compute the value of a color to a hext value
	*  @method colorToHex
	*  @private
	*  @param {int} value A color value from 0 to 255
	*  @param {int} delta The amoutn to shift by
	*  @param {String} The single hex value
	*/
	var valueToHex = function(value, delta)
	{
		var computedValue = !isNaN(delta) ? value + delta : value;
		if (computedValue < 0) {
			computedValue = 0;
		} 
		else if (computedValue > 255)
		{
			computedValue = 255;
		}
		computedValue = Math.round(computedValue).toString(16);
		return computedValue.length == 1 ? "0" + computedValue : computedValue;
	};

	/**
	*  Execute a JSFL command
	*  @method execute
	*  @param {String} script The JSFL command to run or the path to the JSFL file
	*  @param {Object|Array|Function} [args] The optional arguments to pass to the script or the callback function
	*  @param {Function} [callback] Callback function if args is set to an object or array
	*/
	p.execute = function(script, args, callback)
	{
		// second argument can be callback for arguments
		if (typeof args == "function")
		{
			callback = args;
			args = undefined;
		}

		if (this.supported)
		{
			// Check for script paths
			if (/^([\/a-zA-Z0-9\-|_\.\%\?]+\.js(fl|x)?)$/.test(script))
			{
				var self = this;
				$.get(script, function(data)
					{
						self.execute(data, args, callback);
					}
				);
			}
			else
			{
				// Add the arguments to the global window
				if (args !== undefined)
				{
					script = "var args="+JSON.stringify(args)+";\n"+script;
				}

				var self = this;

				this.csInterface.evalScript(
					script, 
					function(response)
					{
						// No callback, so we'll ignore
						if (callback === undefined) return;

						var unserialized;

						// Check for undefined undefined
						if (unserialized == "undefined")
						{
							unserialized = undefined;
						}
						else
						{
							// Unserialize the response
							try
							{
								unserialized = JSON.parse(response);
							}
							catch(e)
							{
								// Handle syntax error
								unserialized = response;
							}
						}

						// Bind the callback to this extension
						callback.call(self, unserialized);
					}
				);
			}
		}
		else
		{
			Debug.error("Unable to execute commands outside of Flash");
		}
	};

	/**
	*  For debugging purposes
	*  @method toString
	*/
	p.toString = function()
	{
		return "[object FlashExtension(name='"+this.name+"')]";
	};

	// Assign to the parent window
	global.FlashExtension = FlashExtension;

}(window));