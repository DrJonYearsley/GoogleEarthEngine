/**
 * Produce jigsaw images for UCD festival
 *
 * The script uses Landsat data to produce RGNB and NDVI images
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
 * Visualise the data
**/

var exportRGB = function(image) {
  return image.visualize({
    bands: ['R', 'G', 'B'],
    min: 0,
    max: 3000,
    gamma: 1.4
  })
}

print(winter.median())

var winterRGB = exportRGB(winter.median())
var autumnRGB = exportRGB(autumn.median())
var springRGB = exportRGB(spring.median())
var summerRGB = exportRGB(summer.median())


// Bands to visualise for RGB image
var visParams = {
  bands: ['R', 'G', 'B'],
  min: 0,
  max: 3000,
  gamma: 1.4,
};



// Set map centre over Ireland (7 is country view)
Map.setCenter(-7,53.5, 7);


// Add layers for median visual and NDVI images
//Map.addLayer(land)

Map.addLayer(winter.mean(), visParams, 'Winter');
/*
Map.addLayer(spring.mean(), visParams, 'Spring');
Map.addLayer(summer.mean(), visParams, 'Summer');
Map.addLayer(autumn.mean(), visParams, 'Autumn');
*/




// Save images of Ireland in RGB
Export.image.toDrive({
  image: winterRGB,
  description: 'WinterRGB',
  scale: 200,  //m per pixel
  dimensions: "24x40", // WIDTHXHEIGHT
  crs: 'EPSG:2157',   // Save as Irish IRENET95
  region: ireland,
  maxPixels: 1e9,
  fileFormat: 'GeoTIFF',
  formatOptions: {
    cloudOptimized: true
  }
});

Export.image.toDrive({
  image: autumnRGB,
  description: 'AutumnRGB',
  scale: 200,  //m per pixel
  dimensions: "24x40", // WIDTHXHEIGHT
  crs: 'EPSG:2157',   // Save as Irish IRENET95
  region: ireland,
  maxPixels: 1e9,
  fileFormat: 'GeoTIFF',
  formatOptions: {
    cloudOptimized: true
  }
});

Export.image.toDrive({
  image: springRGB,
  description: 'SpringRGB',
  scale: 200,  //m per pixel
  dimensions: "24x40", // WIDTHXHEIGHT
  crs: 'EPSG:2157',   // Save as Irish IRENET95
  region: ireland,
  maxPixels: 1e9,
  fileFormat: 'GeoTIFF',
  formatOptions: {
    cloudOptimized: true
  }
});

Export.image.toDrive({
  image: summerRGB,
  description: 'SummerRGB',
  scale: 200,  //m per pixel
  dimensions: "24x40", // WIDTHXHEIGHT
  crs: 'EPSG:2157',   // Save as Irish IRENET95
  region: ireland,
  maxPixels: 1e9,
  fileFormat: 'GeoTIFF',
  formatOptions: {
    cloudOptimized: true
  }
});



