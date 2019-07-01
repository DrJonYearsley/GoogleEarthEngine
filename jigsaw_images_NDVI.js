/**
 * Produce jigsaw images for UCD festival
 *
 * The script uses Landsat data to produce NDVI images
**/

/**
 * Function to mask clouds based on the pixel_qa band of Landsat SR data.
 * @param {ee.Image} image Input Landsat SR image
 * @return {ee.Image} Cloudmasked Landsat image
 */

// Cloud mask for landsat 4, 5 or 7
var cloudMaskL457 = function(image) {
  var qa = image.select('pixel_qa');
  // If the cloud bit (5) is set and the cloud confidence (7) is high
  // or the cloud shadow bit is set (3), then it's a bad pixel.
  var cloud = qa.bitwiseAnd(1 << 5)
                  .and(qa.bitwiseAnd(1 << 7))
                  .or(qa.bitwiseAnd(1 << 3));
  // Remove edge pixels that don't occur in all bands
  var mask2 = image.mask().reduce(ee.Reducer.min());
  return image.updateMask(cloud.not()).updateMask(mask2);
};

// Cloud mask for Landsat 8
function maskL8sr(image) {
  // Bits 3 and 5 are cloud shadow and cloud, respectively.
  var cloudShadowBitMask = (1 << 3);
  var cloudsBitMask = (1 << 5);
  // Get the pixel QA band.
  var qa = image.select('pixel_qa');
  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
                 .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
  return image.updateMask(mask);
}

/**
 * Functions to rename bands to standardised names
 **/
function renameBandsETM(image) {
  // Rename bands for landsat 7
    var bands = ['B1', 'B2', 'B3', 'B4', 'B5', 'B7', 'pixel_qa'];
    var new_bands = ['B', 'G', 'R', 'NIR', 'SWIR1', 'SWIR2', 'pixel_qa'];
    return image.select(bands).rename(new_bands);
}

function renameBandsOLI(image) {
  // Rename bands for landsat 8
    var bands = ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'pixel_qa'];
    var new_bands = ['B', 'G', 'R', 'NIR', 'SWIR1', 'SWIR2', 'pixel_qa'];
    return image.select(bands).rename(new_bands);
}

function renameBandsMODIS(image) {
  // Rename bands for MODIS
    var bands = ['sur_refl_b01', 'sur_refl_b02', 'sur_refl_b03',
    'sur_refl_b04', 'sur_refl_b05', 'sur_refl_b06', 'sur_refl_b07','QC_500m'];
    var new_bands = ['R', 'NIR', 'B', 'G', 'Cirrus', 'SWIR1', 'SWIR2','pixel_qa'];
    return image.select(bands).rename(new_bands);
}

function rescale(image) {
   // Apply scaling factor for MODIS
  return image.multiply(0.0001)
}

// Set lat long bounding box for Ireland
var ireland = ee.Geometry.Rectangle(-10.5,51.3,-5.4,55.4)

// Define a land mask from the MODIS products
var land = ee.ImageCollection("MODIS/006/MOD44W")
              .filterBounds(ireland);





/**
 * Make a range of Satellite data available
 **/

// MODIS (ver 6) surface reflectance
var modis = ee.ImageCollection("MODIS/006/MOD09GA")
              .filterBounds(ireland)
              .map(renameBandsMODIS);


// Landsat 7 surface reflectance (Tier 1 = quality controlled)
var landsat7 = ee.ImageCollection('LANDSAT/LE07/C01/T1_SR')
                  .filter(ee.Filter.calendarRange(1999,2018,'year'))
                  .filterBounds(ireland)
                  .map(cloudMaskL457)
                  .map(renameBandsETM);


// Landsat 8 surface reflectance  (Tier 1 = quality controlled)
var landsat8 = ee.ImageCollection('LANDSAT/LC08/C01/T1_SR')
                  .filter(ee.Filter.calendarRange(2013,2019,'year'))
                  .filterBounds(ireland)
                  .map(renameBandsOLI)
                  .map(maskL8sr);

/**
// Landsat 8 NDVI product
var ndvi_landsat8 = ee.ImageCollection('LANDSAT/LC08/C01/T1_8DAY_NDVI')
                  .filter(ee.Filter.calendarRange(2013,2019,'year'))
                  .filterBounds(ireland);
**/


// Define EOdata to be one of the satellite products
var EOdata = landsat7


/**
 * Filter satellite data by season
 **/

var winter = EOdata.filter(ee.Filter.or(ee.Filter.calendarRange(1,2,'month'),
                                       ee.Filter.calendarRange(12,12,'month')))
var spring = EOdata.filter(ee.Filter.calendarRange(3,5,'month'))
var summer = EOdata.filter(ee.Filter.calendarRange(6,8,'month'))
var autumn = EOdata.filter(ee.Filter.calendarRange(9,11,'month'))



/**
 * Define funcions to compute NDVI and EVI using an expression.
**/

var evi = function(image) {
  return image.expression(
    '2.5 * (nir - red) / (nir + 6 * red - 7.5 * blue + 1)',
    {
        red: image.select('R'),    // 620-670nm, RED
        nir: image.select('NIR'),    // 841-876nm, NIR
        blue: image.select('B')    // 459-479nm, BLUE
    }).float();
};

var ndvi = function(image) {
  return image.expression(
    '(nir - red) / (nir + red)',
    {
        red: image.select('R'),    // 620-670nm, RED
        nir: image.select('NIR'),    // 841-876nm, NIR
    }).float().select('NIR').rename('NDVI');
};


// Function to set upper and lower NDVI thresholds (min=0.1, max=1)
var threshold = function(image) {
  return image.updateMask(image.gte(0.1).and(image.lte(1)))
}
// Use NDVI function on EO image collections and take the median value
var ndvi_winter = threshold(winter.map(ndvi).median());
var ndvi_spring = threshold(spring.map(ndvi).median());
var ndvi_summer = threshold(summer.map(ndvi).median());
var ndvi_autumn = threshold(autumn.map(ndvi).median());








/**
 * Visualise the data
**/

 // Make a palette for the NDVI: a list of hex strings.
var palette = ['FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718',
               '74A901', '66A000', '529400', '3E8601', '207401', '056201',
               '004C00', '023B01', '012E01', '011D01', '011301'];

// Bands to visualise for RGB image
var visParams = {
  bands: ['R', 'G', 'B'],
  min: 0,
  max: 3000,
  gamma: 1.4,
};

print(ndvi_winter)  // View VI data object in the console

// Save NDVI as a visualisation to export
var export_ndvi = function(image) {
  return image.visualize({
    bands: 'NDVI',
    min: 0.2,
    max: 0.9,
    palette: palette
  })
}

var ndvi_winterout = export_ndvi(ndvi_winter)
var ndvi_springout = export_ndvi(ndvi_spring)
var ndvi_summerout = export_ndvi(ndvi_summer)
var ndvi_autumnout = export_ndvi(ndvi_autumn)



// Set map centre over Ireland (7 is country view)
Map.setCenter(-7,53.5, 7);


// Add layers for median NDVI images

Map.addLayer(ndvi_winter, {min: 0.2, max: 0.9, palette: palette},'Winter NDVI');
Map.addLayer(ndvi_spring, {min: 0.2, max: 0.9, palette: palette}, 'Spring NDVI');
Map.addLayer(ndvi_summer, {min: 0.2, max: 0.9, palette: palette}, 'Summer NDVI');
Map.addLayer(ndvi_autumn, {min: 0.2, max: 0.9, palette: palette}, 'Autumn NDVI');








// =========================================
// save images of NDVI


Export.image.toDrive({
  image: ndvi_winterout,
  description: 'WinterNDVI',
  scale: 100,  //m per pixel
  dimensions: "24x40", // WIDTHXHEIGHT
  crs: 'EPSG:2157',   // Save as Irish IRENET95
  region: ireland,
  maxPixels: 1e9
});


Export.image.toDrive({
  image: ndvi_springout,
  description: 'SpringNDVI',
  scale: 100,  //m per pixel
  dimensions: "24x40", // WIDTHXHEIGHT
  crs: 'EPSG:2157',   // Save as Irish IRENET95
  region: ireland,
  maxPixels: 1e9
});

Export.image.toDrive({
  image: ndvi_summerout,
  description: 'SummerNDVI',
  scale: 100,  //m per pixel
  dimensions: "24x40", // WIDTHXHEIGHT
  crs: 'EPSG:2157',   // Save as Irish IRENET95
  region: ireland,
  maxPixels: 1e9
});

Export.image.toDrive({
  image: ndvi_autumnout,
  description: 'AutumnNDVI',
  scale: 100,  //m per pixel
  dimensions: "24x40", // WIDTHXHEIGHT
  crs: 'EPSG:2157',   // Save as Irish IRENET95
  region: ireland,
  maxPixels: 1e9
});


