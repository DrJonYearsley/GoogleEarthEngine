/**
 * An NDVI visualisation for the UCD festival
 *
 * Script loads Sentinel 2 data (centred on Dublin),
 * calculates NDVI
 * and displays NDVI alongside RGB image in a split plot
**/



/**
 * Function to mask clouds using the Sentinel-2 QA band
 * @param {ee.Image} image Sentinel-2 image
 * @return {ee.Image} cloud masked Sentinel-2 image
 */
function maskS2clouds(image) {
  var qa = image.select('QA60');

  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return image.updateMask(mask).divide(10000);
}


// Map the function over one year of data and take the median.
// Load Sentinel-2 TOA reflectance data.
var sentinel = ee.ImageCollection('COPERNICUS/S2')
                  .filterDate('2018-05-01', '2018-06-30')
                  // Pre-filter to get less cloudy granules.
                  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                  .map(maskS2clouds);

// Specify bands to produce RGB image
var rgbVis = {
  min: 0.0,
  max: 0.3,
  bands: ['B4', 'B3', 'B2'],
};

// Take median of pixels
var img = sentinel.median()

// Compute NDVI using an expression.  The second argument is a map from
// variable name to band name in the input image.
var ndvi = img.expression(
    '(nir - red) / (nir + red)',
    {
        red: img.select('B4'),    // 620-670nm, RED
        nir: img.select('B8'),    // 841-876nm, NIR
    });

// Make a palette: a list of hex strings.
var palette = ['FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718',
               '74A901', '66A000', '529400', '3E8601', '207401', '056201',
               '004C00', '023B01', '012E01', '011D01', '011301'];

var paletteNames = ['None','Very Low','','','Low','','','','','Medium','','','','High','','','Very High']

/*
 * Set up the maps and control widgets
 */

// Create the left map, and have it display layer 0.
var leftMap = ui.Map();
leftMap.setControlVisibility(false);
leftMap.addLayer(img, rgbVis, 'RGB');


// Create the title label.
var title1 = ui.Label('Visual Image')
title1.style().set('position', 'top-left')
leftMap.add(title1);

// Create the right map, and have it display layer 1.
var rightMap = ui.Map();
rightMap.setControlVisibility(false);
rightMap.addLayer(ndvi,{min: 0, max: 1, palette: palette}, 'NDVI')
// Create the title label.
var title2 = ui.Label('Infrared - Red')
title2.style().set('position', 'top-right')
rightMap.add(title2);

// Create a SplitPanel to hold the adjacent, linked maps.
var splitPanel = ui.SplitPanel({
  firstPanel: leftMap,
  secondPanel: rightMap,
  wipe: true,
  style: {stretch: 'both'}
});

// Set the SplitPanel as the only thing in the UI root.
ui.root.widgets().reset([splitPanel]);
var linker = ui.Map.Linker([leftMap, rightMap]);
leftMap.setCenter(-6.13498, 53.29408, 13);


// Add legend to the NDV plot
// Create the panel for the legend items.
var legend = ui.Panel({
  style: {
    position: 'bottom-right',
    padding: '8px 15px'
  }
});

// Create and add the legend title.
var legendTitle = ui.Label({
  value: 'Plant Productivity',
  style: {
    fontWeight: 'bold',
    fontSize: '18px',
    margin: '0 0 4px 0',
    padding: '0'
  }
});
legend.add(legendTitle);

//var loading = ui.Label('Loading legend...', {margin: '2px 0 4px 0'});
//legend.add(loading);

// Creates and styles 1 row of the legend.
var makeRow = function(color, name) {
  // Create the label that is actually the colored box.

  var colorBox = ui.Label({
    style: {
      backgroundColor: '#' + color,
      // Use padding to give the box height and width.
      padding: '8px',
      margin: '0 0 4px 0'
    }
  });

  // Create the label filled with the description text.
  var description = ui.Label({
    value: name,
    style: {margin: '0 0 0px 6px'}
  });

  return ui.Panel({
    widgets: [colorBox, description],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
};

// use getInfo to make the names client-side
//var newNames = names.getInfo();

print(palette)


legend.add(makeRow(palette[0], paletteNames[0]));
legend.add(makeRow(palette[1], paletteNames[1]));
legend.add(makeRow(palette[4], paletteNames[4]));
legend.add(makeRow(palette[9], paletteNames[9]));
legend.add(makeRow(palette[13], paletteNames[13]));
legend.add(makeRow(palette[16], paletteNames[16]));

/**
for (var i = 0; i < palette.length; i++) {
    legend.add(makeRow(palette[i], paletteNames[i]));
}
**/

rightMap.add(legend);



