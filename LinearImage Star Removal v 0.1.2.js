// ----------------------------------------------------------------------------
// PixInsight JavaScript Runtime API - PJSR Version 1.0
// ----------------------------------------------------------------------------
// LinearStarRemoval Version 0.1.0 - Released 02.07.21
// ----------------------------------------------------------------------------
//
//
// ****************************************************************************
// PixInsight JavaScript Runtime API - PJSR Version 1.0
// ****************************************************************************
// LinearStarRemoval.js - Released 2021/02/21 00:00:00 UTC
// ****************************************************************************
//
// This file is part of LinearStarRemoval Script Version 0.1.0
//
// Copyright (C) 2021 Alex Woronow. All Rights Reserved.
//
// Redistribution and use in both source and binary forms, with or without
// modification, is permitted provided that the following conditions are met:
//
// 1. All redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
//
// 2. All redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//
// 3. Neither the names "PixInsight" and "Pleiades Astrophoto", nor the names
//    of their contributors, may be used to endorse or promote products derived
//    from this software without specific prior written permission. For written
//    permission, please contact info@pixinsight.com.
//
// 4. All products derived from this software, in any form whatsoever, must
//    reproduce the following acknowledgment in the end-user documentation
//    and/or other materials provided with the product:
//
//    "This product is based on software from the PixInsight project, developed
//    by Pleiades Astrophoto and its contributors (http://pixinsight.com/)."
//
//    Alternatively, if that is where third-party acknowledgments normally
//    appear, this acknowledgment must be reproduced in the product itself.
//
// THIS SOFTWARE IS PROVIDED BY PLEIADES ASTROPHOTO AND ITS CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
// TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
// PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL PLEIADES ASTROPHOTO OR ITS
// CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
// EXEMPLARY OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, BUSINESS
// INTERRUPTION; PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; AND LOSS OF USE,
// DATA OR PROFITS) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.
// ****************************************************************************

/*
 * BUG REPORTING
 * Please send information on bugs to Alex@FaintLightPhotography.com. Include
 * the version number of the script you are reporting as well as relevant
 * parts of the Process Console output and other outputs/messages.
*/

#feature-id    Utilities > LinearStarRemoval

#feature-info  Applies starnet on a linear image.

#include <pjsr/ColorSpace.jsh>
#include <pjsr/UndoFlag.jsh>
#include <pjsr/StdCursor.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/FontFamily.jsh>
#include <pjsr/SampleType.jsh>
#include <pjsr/Color.jsh>

#define VERSION "0.1.0"

// define a global variable containing script's parameters
var LinImageStarRemoval = {

   STF_c0: 0,
   STF_m: 0,
};

//------------------------------------------------------------------------------
// Construct the script dialog interface
//------------------------------------------------------------------------------
function parametersDialogPrototype() {

   this.__base__ = Dialog;
   this.__base__();

   this.windowTitle = "Linear-Image Star Removal (v"+VERSION+")";

   this.Header = new Label(this);
   with (this.Header) {
      margin = 10;
      text = "LinearImage Star Removal \n" +
      " Remove the stars from the active LINEAR image and create a new,\n" +
         " linear starless image.\n" +
         "\n    Alex Woronow \n v0.1.0. 2021";
      textAlignment = TextAlign_Left|TextAlign_Center;
   minHeight = 100;
   maxHeight = 100;
   minWidth = 300;
   maxWidth = 300;
   }

   // Buttons
   //
   // instance button
   this.newInstanceButton = new ToolButton( this );
   this.newInstanceButton.icon = this.scaledResource( ":/process-interface/new-instance.png" );
   this.newInstanceButton.setScaledFixedSize( 24, 24 );
   this.newInstanceButton.toolTip = "New Instance";
   this.newInstanceButton.onMousePress = () => {
      this.newInstance();
   };

   // doc button
   this.documentationButton = new ToolButton(this);
   this.documentationButton.icon = this.scaledResource( ":/process-interface/browse-documentation.png" );
   this.documentationButton.toolTip = "<p>See the folder containing this script " +
                                      "for the documentation </p>";

   // cancel button
   this.cancelButton = new PushButton(this);
   this.cancelButton.text = "Exit";
   this.cancelButton.backgroundColor = 0x22ff0000;
   this.cancelButton.textColor = 0xfffffff0;
   this.cancelButton.onClick = function() {
      this.dialog.cancel();
   };
   this.cancelButton.defaultButton = true;
   this.cancelButton.hasFocus = true;

   // execution button
   this.execButton = new PushButton(this);
   this.execButton.text = "RUN";
   this.execButton.toolTip = "Invoke Script on active image.";
   this.execButton.backgroundColor = 0x2200ff00;
   this.execButton.width = 40;
   this.execButton.enabled = true;
   this.execButton.onClick = () => {
      this.ok();
   };

     // create a horizontal sizer to layout the execution-row buttons
   this.execButtonSizer = new HorizontalSizer;
   this.execButtonSizer.add(this.newInstanceButton);
   this.execButtonSizer.add(this.documentationButton);
   this.execButtonSizer.addStretch();
   this.execButtonSizer.add(this.cancelButton);
   this.execButtonSizer.add(this.execButton)

   this.sizer = new VerticalSizer;
   this.sizer.add(this.Header);
   this.sizer.add(this.execButtonSizer);
   this.adjustToContents();
};


//------------------------------------------------------------------------------
//-------- Use HT to to stretch the image with params from STF -----------------
//------------------------------------------------------------------------------
function HTF(targetImage) {

   var P = new HistogramTransformation;
      // This first traunche of code is from Juan Conejero
      let shadowsClipping = -2.80;  // MAD units
      let targetBackground = 0.25;  // Mad Units
      let rgbLinked = true;

      let stf = new ScreenTransferFunction;
      let n = targetImage.image.isColor ? 3 : 1; // n channels
      let median = targetImage.computeOrFetchProperty( "Median" );
      let mad = targetImage.computeOrFetchProperty( "MAD" );

      mad.mul( 1.4826 ); // coherent with a normal distribution
      // find values for median across channels (3 rgb)
      let c0 = 0, m = 0;
      for ( var c = 0; c < n; ++c )
      {
         if ( 1 + mad.at( c ) !== 1 )
            c0 += median.at( c ) + shadowsClipping * mad.at( c );
         m  += median.at( c );
      }

      // values of ShadowClipping and and Median in pixel-intensity units
      // these are preserved for subsequent uses, if any. To do so, see
      // https://stackoverflow.com/questions/4937665/returning-multiple-values-in-javascript
      c0 = Math.range( c0/n, 0.0, 1.0 );
      m = Math.mtf( targetBackground, m/n - c0 );

      P.H = [ // c0, m, c1, r0, r1
      [0.00000000, 0.50000000, 1.00000000, 0.00000000, 1.00000000],
      [0.00000000, 0.50000000, 1.00000000, 0.00000000, 1.00000000],
      [0.00000000, 0.50000000, 1.00000000, 0.00000000, 1.00000000],
      [c0,         m,          1.00000000, 0.00000000, 1.00000000],
      [0.00000000, 0.50000000, 1.00000000, 0.00000000, 1.00000000] ];

      // save the stretch parameters for destretching after starnet
      this.STF_c0 = c0;
      this.STF_m = m;

      P.executeOn( targetImage );
};


//------------------------------------------------------------------------------
//----------------- Run StarNet on the "stretched" image -----------------------
//------------------------------------------------------------------------------
function StarNetDo( targetImage) {

  var P = new StarNet;
     P.stride = StarNet.prototype.Stride_128;
     P.mask = false;
     if( !P.canExecuteOn(targetImage) ) {
        Console.criticalln (" Cannot run StarNet on ", targetImage.id );
        return 0;
     }
     P.executeOn(targetImage);
     return 1;
 };

//------------------------------------------------------------------------------
//---------- Restore the starless image to its linear state ----------------------
//------------------------------------------------------------------------------
function RestoreToLinear(targetImage) {

  var P = new PixelMath;

      P.expression = "A="+targetImage.id+";\n" +
      "s="+this.STF_c0+";\n" +
      "m="+this.STF_m+";\n" +
      "( m*A / ( (2*m-1)*A - m+1 ) ) * (1-s) + s";

      P.expression1 = "";
      P.expression2 = "";
      P.expression3 = "";
      P.useSingleExpression = true;
      P.symbols = "m,s,A";
      P.clearImageCacheAndExit = false;
      P.cacheGeneratedImages = false;
      P.generateOutput = true;
      P.singleThreaded = false;
      P.optimization = true;
      P.use64BitWorkingImage = false;
      P.rescale = false;
      P.rescaleLower = 0;
      P.rescaleUpper = 1;
      P.truncate = true;
      P.truncateLower = 0;
      P.truncateUpper = 1;
      P.createNewImage = false;
      P.showNewImage = true;
      P.newImageId = "";
      P.newImageWidth = 0;
      P.newImageHeight = 0;
      P.newImageAlpha = false;
      P.newImageColorSpace = PixelMath.prototype.SameAsTarget;
      P.newImageSampleFormat = PixelMath.prototype.SameAsTarget;
      P.executeOn(targetImage);
};

//------------------------------------------------------------------------------
//------------------------------- Quick STF ------------------------------------
//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
//------------- Apply STF to final images, if requested ------------------------
//---------- Fashioned after STFAutoStretch by J. Conejero ---------------------
//------------ Parameters have been calculated previously ----------------------
//------------------------------------------------------------------------------
function QuickSTF ( targetImage ) {

   var stf = new ScreenTransferFunction;
      let c0 = this.STF_c0;
      let m = this.STF_m;

      stf.STF = [ // c0, c1, m, r0, r1
                  [c0, 1, m, 0, 1],
                  [c0, 1, m, 0, 1],
                  [c0, 1, m, 0, 1],
                  [0, 1, 0.5, 0, 1] ];

      stf.executeOn ( targetImage );
}

//------------------------------------------------------------------------------
//------------------ Call the required functions -------------------------------
//------------------------------------------------------------------------------
function StarsBeGone(target) {

   Console.writeln ("LinearStarRemoval processing ", target.id);
   // stretch the image
   HTF( target );

   // apply starnet
   if ( !StarNetDo( target ) ) {
      Console. criticalln( "Error in Starnet--EXITING" );
      return 0;
   }

   // restore image to unstreteched state and apply screen stretch
   RestoreToLinear (target );
   QuickSTF( target );

   return 1;
};


//------------------------------------------------------------------------------
parametersDialogPrototype.prototype = new Dialog;
//------------------------------------------------------------------------------


//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
function main() {
   Console.abortEnabled = true;

   if (Parameters.isGlobalTarget) {
      Console.writeln("Global execution");
      this.StarsBeGone(ImageWindow.activeWindow.mainView);
      Console.writeln ("DONE");
      Console.hide();
      return;
   }

   if (Parameters.isViewTarget) {
      Console.writeln("View execution");
      //var myTargetView = Parameters.targetView;
      this.StarsBeGone(Parameters.targetView);
      //this.StarsBeGone(ImageWindow.activeWindow.mainView);
      Console.writeln ("DONE");
      Console.hide();
      return;
   }

    // execute via user interface
   let parametersDialog = new parametersDialogPrototype();
   if( parametersDialog.execute() == 0 ) return;

   // normal execution via a dialog
   this.StarsBeGone(ImageWindow.activeWindow.mainView);

   Console.writeln ("DONE");
   Console.hide();
};

main();

