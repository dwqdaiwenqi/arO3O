 /*
Copyright (c) 2011 Juan Mellado

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/*
/*
/*
References:
- "OpenCV: Open Computer Vision Library"
  http://sourceforge.net/projects/opencvlibrary/
- "Stack Blur: Fast But Goodlooking"
  http://incubator.quasimondo.com/processing/fast_blur_deluxe.php
*/

var CV = CV || {};

CV.Image = function(width, height, data){
  this.width = width || 0;
  this.height = height || 0;
  this.data = data || [];
};

CV.grayscale = function(imageSrc, imageDst){
  var src = imageSrc.data, dst = imageDst.data, len = src.length,
      i = 0, j = 0;

  for (; i < len; i += 4){
    dst[j ++] =
      (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114 + 0.5) & 0xff;
  }
  
  imageDst.width = imageSrc.width;
  imageDst.height = imageSrc.height;
  
  return imageDst;
}



CV.threshold = function(imageSrc, imageDst, threshold){
  var src = imageSrc.data, dst = imageDst.data,
      len = src.length, tab = [], i;

  for (i = 0; i < 256; ++ i){
    tab[i] = i <= threshold? 0: 255;
  }

  for (i = 0; i < len; ++ i){
    dst[i] = tab[ src[i] ];
  }

  imageDst.width = imageSrc.width;
  imageDst.height = imageSrc.height;

  return imageDst;
};

CV.adaptiveThreshold = function(imageSrc, imageDst, kernelSize, threshold){
  var src = imageSrc.data, dst = imageDst.data, len = src.length, tab = [], i;

  CV.stackBoxBlur(imageSrc, imageDst, kernelSize);

  for (i = 0; i < 768; ++ i){
    tab[i] = (i - 255 <= -threshold)? 255: 0;
  }

  for (i = 0; i < len; ++ i){
    dst[i] = tab[ src[i] - dst[i] + 255 ];
  }

  imageDst.width = imageSrc.width;
  imageDst.height = imageSrc.height;
  
  return imageDst;
};

CV.otsu = function(imageSrc){
  var src = imageSrc.data, len = src.length, hist = [],
      threshold = 0, sum = 0, sumB = 0, wB = 0, wF = 0, max = 0,
      mu, between, i;

  for (i = 0; i < 256; ++ i){
    hist[i] = 0;
  }
  
  for (i = 0; i < len; ++ i){
    hist[ src[i] ] ++;
  }

  for (i = 0; i < 256; ++ i){
    sum += hist[i] * i;
  }

  for (i = 0; i < 256; ++ i){
    wB += hist[i];
    if (0 !== wB){
    
      wF = len - wB;
      if (0 === wF){
        break;
      }

      sumB += hist[i] * i;
      
      mu = (sumB / wB) - ( (sum - sumB) / wF );

      between = wB * wF * mu * mu;
      
      if (between > max){
        max = between;
        threshold = i;
      }
    }
  }

  return threshold;
};

CV.stackBoxBlurMult =
  [1, 171, 205, 293, 57, 373, 79, 137, 241, 27, 391, 357, 41, 19, 283, 265];

CV.stackBoxBlurShift =
  [0, 9, 10, 11, 9, 12, 10, 11, 12, 9, 13, 13, 10, 9, 13, 13];

CV.BlurStack = function(){
  this.color = 0;
  this.next = null;
};

CV.stackBoxBlur = function(imageSrc, imageDst, kernelSize){
  var src = imageSrc.data, dst = imageDst.data,
      height = imageSrc.height, width = imageSrc.width,
      heightMinus1 = height - 1, widthMinus1 = width - 1,
      size = kernelSize + kernelSize + 1, radius = kernelSize + 1,
      mult = CV.stackBoxBlurMult[kernelSize],
      shift = CV.stackBoxBlurShift[kernelSize],
      stack, stackStart, color, sum, pos, start, p, x, y, i;

  stack = stackStart = new CV.BlurStack();
  for (i = 1; i < size; ++ i){
    stack = stack.next = new CV.BlurStack();
  }
  stack.next = stackStart;

  pos = 0;

  for (y = 0; y < height; ++ y){
    start = pos;
    
    color = src[pos];
    sum = radius * color;
    
    stack = stackStart;
    for (i = 0; i < radius; ++ i){
      stack.color = color;
      stack = stack.next;
    }
    for (i = 1; i < radius; ++ i){
      stack.color = src[pos + i];
      sum += stack.color;
      stack = stack.next;
    }
  
    stack = stackStart;
    for (x = 0; x < width; ++ x){
      dst[pos ++] = (sum * mult) >>> shift;
      
      p = x + radius;
      p = start + (p < widthMinus1? p: widthMinus1);
      sum -= stack.color - src[p];
      
      stack.color = src[p];
      stack = stack.next;
    }
  }

  for (x = 0; x < width; ++ x){
    pos = x;
    start = pos + width;
    
    color = dst[pos];
    sum = radius * color;
    
    stack = stackStart;
    for (i = 0; i < radius; ++ i){
      stack.color = color;
      stack = stack.next;
    }
    for (i = 1; i < radius; ++ i){
      stack.color = dst[start];
      sum += stack.color;
      stack = stack.next;
      
      start += width;
    }
    
    stack = stackStart;
    for (y = 0; y < height; ++ y){
      dst[pos] = (sum * mult) >>> shift;
      
      p = y + radius;
      p = x + ( (p < heightMinus1? p: heightMinus1) * width );
      sum -= stack.color - dst[p];
      
      stack.color = dst[p];
      stack = stack.next;
      
      pos += width;
    }
  }

  return imageDst;
};

CV.gaussianBlur = function(imageSrc, imageDst, imageMean, kernelSize){
  var kernel = CV.gaussianKernel(kernelSize);

  imageDst.width = imageSrc.width;
  imageDst.height = imageSrc.height;
  
  imageMean.width = imageSrc.width;
  imageMean.height = imageSrc.height;

  CV.gaussianBlurFilter(imageSrc, imageMean, kernel, true);
  CV.gaussianBlurFilter(imageMean, imageDst, kernel, false);

  return imageDst;
};

CV.gaussianBlurFilter = function(imageSrc, imageDst, kernel, horizontal){
  var src = imageSrc.data, dst = imageDst.data,
      height = imageSrc.height, width = imageSrc.width,
      pos = 0, limit = kernel.length >> 1,
      cur, value, i, j, k;
      
  for (i = 0; i < height; ++ i){
    
    for (j = 0; j < width; ++ j){
      value = 0.0;
    
      for (k = -limit; k <= limit; ++ k){

        if (horizontal){
          cur = pos + k;
          if (j + k < 0){
            cur = pos;
          }
          else if (j + k >= width){
            cur = pos;
          }
        }else{
          cur = pos + (k * width);
          if (i + k < 0){
            cur = pos;
          }
          else if (i + k >= height){
            cur = pos;
          }
        }

        value += kernel[limit + k] * src[cur];
      }
    
      dst[pos ++] = horizontal? value: (value + 0.5) & 0xff;
    }
  }

  return imageDst;
};

CV.gaussianKernel = function(kernelSize){
  var tab =
    [ [1],
      [0.25, 0.5, 0.25],
      [0.0625, 0.25, 0.375, 0.25, 0.0625],
      [0.03125, 0.109375, 0.21875, 0.28125, 0.21875, 0.109375, 0.03125] ],
    kernel = [], center, sigma, scale2X, sum, x, i;

  if ( (kernelSize <= 7) && (kernelSize % 2 === 1) ){
    kernel = tab[kernelSize >> 1];
  }else{
    center = (kernelSize - 1.0) * 0.5;
    sigma = 0.8 + (0.3 * (center - 1.0) );
    scale2X = -0.5 / (sigma * sigma);
    sum = 0.0;
    for (i = 0; i < kernelSize; ++ i){
      x = i - center;
      sum += kernel[i] = Math.exp(scale2X * x * x);
    }
    sum = 1 / sum;
    for (i = 0; i < kernelSize; ++ i){
      kernel[i] *= sum;
    }  
  }

  return kernel;
};

CV.findContours = function(imageSrc, binary){
  var width = imageSrc.width, height = imageSrc.height, contours = [],
      src, deltas, pos, pix, nbd, outer, hole, i, j;
  
  src = CV.binaryBorder(imageSrc, binary);

  deltas = CV.neighborhoodDeltas(width + 2);

  pos = width + 3;
  nbd = 1;

  for (i = 0; i < height; ++ i, pos += 2){
  
    for (j = 0; j < width; ++ j, ++ pos){
      pix = src[pos];

      if (0 !== pix){
        outer = hole = false;

        if (1 === pix && 0 === src[pos - 1]){
          outer = true;
        }
        else if (pix >= 1 && 0 === src[pos + 1]){
          hole = true;
        }

        if (outer || hole){
          ++ nbd;
          
          contours.push( CV.borderFollowing(src, pos, nbd, {x: j, y: i}, hole, deltas) );
        }
      }
    }
  }  

  return contours;
};

CV.borderFollowing = function(src, pos, nbd, point, hole, deltas){
  var contour = [], pos1, pos3, pos4, s, s_end, s_prev;

  contour.hole = hole;
      
  s = s_end = hole? 0: 4;
  do{
    s = (s - 1) & 7;
    pos1 = pos + deltas[s];
    if (src[pos1] !== 0){
      break;
    }
  }while(s !== s_end);
  
  if (s === s_end){
    src[pos] = -nbd;
    contour.push( {x: point.x, y: point.y} );

  }else{
    pos3 = pos;
    s_prev = s ^ 4;

    while(true){
      s_end = s;
    
      do{
        pos4 = pos3 + deltas[++ s];
      }while(src[pos4] === 0);
      
      s &= 7;
      
      if ( ( (s - 1) >>> 0) < (s_end >>> 0) ){
        src[pos3] = -nbd;
      }
      else if (src[pos3] === 1){
        src[pos3] = nbd;
      }

      contour.push( {x: point.x, y: point.y} );
      
      s_prev = s;

      point.x += CV.neighborhood[s][0];
      point.y += CV.neighborhood[s][1];

      if ( (pos4 === pos) && (pos3 === pos1) ){
        break;
      }
      
      pos3 = pos4;
      s = (s + 4) & 7;
    }
  }

  return contour;
};

CV.neighborhood = 
  [ [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1] ];

CV.neighborhoodDeltas = function(width){
  var deltas = [], len = CV.neighborhood.length, i = 0;
  
  for (; i < len; ++ i){
    deltas[i] = CV.neighborhood[i][0] + (CV.neighborhood[i][1] * width);
  }
  
  return deltas.concat(deltas);
};

CV.approxPolyDP = function(contour, epsilon){
  var slice = {start_index: 0, end_index: 0},
      right_slice = {start_index: 0, end_index: 0},
      poly = [], stack = [], len = contour.length,
      pt, start_pt, end_pt, dist, max_dist, le_eps,
      dx, dy, i, j, k;
  
  epsilon *= epsilon;
  
  k = 0;
  
  for (i = 0; i < 3; ++ i){
    max_dist = 0;
    
    k = (k + right_slice.start_index) % len;
    start_pt = contour[k];
    if (++ k === len) {k = 0;}
  
    for (j = 1; j < len; ++ j){
      pt = contour[k];
      if (++ k === len) {k = 0;}
    
      dx = pt.x - start_pt.x;
      dy = pt.y - start_pt.y;
      dist = dx * dx + dy * dy;

      if (dist > max_dist){
        max_dist = dist;
        right_slice.start_index = j;
      }
    }
  }

  if (max_dist <= epsilon){
    poly.push( {x: start_pt.x, y: start_pt.y} );

  }else{
    slice.start_index = k;
    slice.end_index = (right_slice.start_index += slice.start_index);
  
    right_slice.start_index -= right_slice.start_index >= len? len: 0;
    right_slice.end_index = slice.start_index;
    if (right_slice.end_index < right_slice.start_index){
      right_slice.end_index += len;
    }
    
    stack.push( {start_index: right_slice.start_index, end_index: right_slice.end_index} );
    stack.push( {start_index: slice.start_index, end_index: slice.end_index} );
  }

  while(stack.length !== 0){
    slice = stack.pop();
    
    end_pt = contour[slice.end_index % len];
    start_pt = contour[k = slice.start_index % len];
    if (++ k === len) {k = 0;}
    
    if (slice.end_index <= slice.start_index + 1){
      le_eps = true;
    
    }else{
      max_dist = 0;

      dx = end_pt.x - start_pt.x;
      dy = end_pt.y - start_pt.y;
      
      for (i = slice.start_index + 1; i < slice.end_index; ++ i){
        pt = contour[k];
        if (++ k === len) {k = 0;}
        
        dist = Math.abs( (pt.y - start_pt.y) * dx - (pt.x - start_pt.x) * dy);

        if (dist > max_dist){
          max_dist = dist;
          right_slice.start_index = i;
        }
      }
      
      le_eps = max_dist * max_dist <= epsilon * (dx * dx + dy * dy);
    }
    
    if (le_eps){
      poly.push( {x: start_pt.x, y: start_pt.y} );

    }else{
      right_slice.end_index = slice.end_index;
      slice.end_index = right_slice.start_index;

      stack.push( {start_index: right_slice.start_index, end_index: right_slice.end_index} );
      stack.push( {start_index: slice.start_index, end_index: slice.end_index} );
    }
  }
  
  return poly;
};

CV.warp = function(imageSrc, imageDst, contour, warpSize){
  var src = imageSrc.data, dst = imageDst.data,
      width = imageSrc.width, height = imageSrc.height,
      pos = 0,
      sx1, sx2, dx1, dx2, sy1, sy2, dy1, dy2, p1, p2, p3, p4,
      m, r, s, t, u, v, w, x, y, i, j;
  
  m = CV.getPerspectiveTransform(contour, warpSize - 1);

  r = m[8];
  s = m[2];
  t = m[5];
  
  for (i = 0; i < warpSize; ++ i){
    r += m[7];
    s += m[1];
    t += m[4];

    u = r;
    v = s;
    w = t;
    
    for (j = 0; j < warpSize; ++ j){
      u += m[6];
      v += m[0];
      w += m[3];

      x = v / u;
      y = w / u;

      sx1 = x >>> 0;
      sx2 = (sx1 === width - 1)? sx1: sx1 + 1;
      dx1 = x - sx1;
      dx2 = 1.0 - dx1;

      sy1 = y >>> 0;
      sy2 = (sy1 === height - 1)? sy1: sy1 + 1;
      dy1 = y - sy1;
      dy2 = 1.0 - dy1;

      p1 = p2 = sy1 * width;
      p3 = p4 = sy2 * width;

      dst[pos ++] = 
        (dy2 * (dx2 * src[p1 + sx1] + dx1 * src[p2 + sx2]) +
         dy1 * (dx2 * src[p3 + sx1] + dx1 * src[p4 + sx2]) ) & 0xff;

    }
  }

  imageDst.width = warpSize;
  imageDst.height = warpSize;

  return imageDst;
};

CV.getPerspectiveTransform = function(src, size){
  var rq = CV.square2quad(src);
  
  rq[0] /= size;
  rq[1] /= size;
  rq[3] /= size;
  rq[4] /= size;
  rq[6] /= size;
  rq[7] /= size;
  
  return rq;
};

CV.square2quad = function(src){
  var sq = [], px, py, dx1, dx2, dy1, dy2, den;
  
  px = src[0].x - src[1].x + src[2].x - src[3].x;
  py = src[0].y - src[1].y + src[2].y - src[3].y;
  
  if (0 === px && 0 === py){
    sq[0] = src[1].x - src[0].x;
    sq[1] = src[2].x - src[1].x;
    sq[2] = src[0].x;
    sq[3] = src[1].y - src[0].y;
    sq[4] = src[2].y - src[1].y;
    sq[5] = src[0].y;
    sq[6] = 0;
    sq[7] = 0;
    sq[8] = 1;

  }else{
    dx1 = src[1].x - src[2].x;
    dx2 = src[3].x - src[2].x;
    dy1 = src[1].y - src[2].y;
    dy2 = src[3].y - src[2].y;
    den = dx1 * dy2 - dx2 * dy1;
  
    sq[6] = (px * dy2 - dx2 * py) / den;
    sq[7] = (dx1 * py - px * dy1) / den;
    sq[8] = 1;
    sq[0] = src[1].x - src[0].x + sq[6] * src[1].x;
    sq[1] = src[3].x - src[0].x + sq[7] * src[3].x;
    sq[2] = src[0].x;
    sq[3] = src[1].y - src[0].y + sq[6] * src[1].y;
    sq[4] = src[3].y - src[0].y + sq[7] * src[3].y;
    sq[5] = src[0].y;
  }

  return sq;
};

CV.isContourConvex = function(contour){
  var orientation = 0, convex = true,
      len = contour.length, i = 0, j = 0,
      cur_pt, prev_pt, dxdy0, dydx0, dx0, dy0, dx, dy;

  prev_pt = contour[len - 1];
  cur_pt = contour[0];

  dx0 = cur_pt.x - prev_pt.x;
  dy0 = cur_pt.y - prev_pt.y;

  for (; i < len; ++ i){
    if (++ j === len) {j = 0;}

    prev_pt = cur_pt;
    cur_pt = contour[j];

    dx = cur_pt.x - prev_pt.x;
    dy = cur_pt.y - prev_pt.y;
    dxdy0 = dx * dy0;
    dydx0 = dy * dx0;

    orientation |= dydx0 > dxdy0? 1: (dydx0 < dxdy0? 2: 3);

    if (3 === orientation){
        convex = false;
        break;
    }

    dx0 = dx;
    dy0 = dy;
  }

  return convex;
};

CV.perimeter = function(poly){
  var len = poly.length, i = 0, j = len - 1,
      p = 0.0, dx, dy;

  for (; i < len; j = i ++){
    dx = poly[i].x - poly[j].x;
    dy = poly[i].y - poly[j].y;
    
    p += Math.sqrt(dx * dx + dy * dy) ;
  }

  return p;
};

CV.minEdgeLength = function(poly){
  var len = poly.length, i = 0, j = len - 1, 
      min = Infinity, d, dx, dy;

  for (; i < len; j = i ++){
    dx = poly[i].x - poly[j].x;
    dy = poly[i].y - poly[j].y;

    d = dx * dx + dy * dy;

    if (d < min){
      min = d;
    }
  }
  
  return Math.sqrt(min);
};

CV.countNonZero = function(imageSrc, square){
  var src = imageSrc.data, height = square.height, width = square.width,
      pos = square.x + (square.y * imageSrc.width),
      span = imageSrc.width - width,
      nz = 0, i, j;
  
  for (i = 0; i < height; ++ i){

    for (j = 0; j < width; ++ j){
    
      if ( 0 !== src[pos ++] ){
        ++ nz;
      }
    }
    
    pos += span;
  }

  return nz;
};

CV.binaryBorder = function(imageSrc, dst){
  var src = imageSrc.data, height = imageSrc.height, width = imageSrc.width,
      posSrc = 0, posDst = 0, i, j;

  for (j = -2; j < width; ++ j){
    dst[posDst ++] = 0;
  }

  for (i = 0; i < height; ++ i){
    dst[posDst ++] = 0;
    
    for (j = 0; j < width; ++ j){
      dst[posDst ++] = (0 === src[posSrc ++]? 0: 1);
    }
    
    dst[posDst ++] = 0;
  }

  for (j = -2; j < width; ++ j){
    dst[posDst ++] = 0;
  }
  
  return dst;
};





/*
Copyright (c) 2011 Juan Mellado

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/*
References:
- "ArUco: a minimal library for Augmented Reality applications based on OpenCv"
  http://www.uco.es/investiga/grupos/ava/node/26
*/

var AR = AR || {};

AR.Marker = function(id, corners){
  this.id = id;
  this.corners = corners;
};

AR.Detector = function(){
  this.grey = new CV.Image();
  this.thres = new CV.Image();
  this.homography = new CV.Image();
  this.binary = [];
  this.contours = [];
  this.polys = [];
  this.candidates = [];
};

AR.Detector.prototype.detect = function(image){
  CV.grayscale(image, this.grey);
  CV.adaptiveThreshold(this.grey, this.thres, 2, 7);
  
  this.contours = CV.findContours(this.thres, this.binary);

  this.candidates = this.findCandidates(this.contours, image.width * 0.20, 0.05, 10);
  this.candidates = this.clockwiseCorners(this.candidates);
  this.candidates = this.notTooNear(this.candidates, 10);

  return this.findMarkers(this.grey, this.candidates, 49);
};

AR.Detector.prototype.findCandidates = function(contours, minSize, epsilon, minLength){
  var candidates = [], len = contours.length, contour, poly, i;

  this.polys = [];
  
  for (i = 0; i < len; ++ i){
    contour = contours[i];

    if (contour.length >= minSize){
      poly = CV.approxPolyDP(contour, contour.length * epsilon);

      this.polys.push(poly);

      if ( (4 === poly.length) && ( CV.isContourConvex(poly) ) ){

        if ( CV.minEdgeLength(poly) >= minLength){
          candidates.push(poly);
        }
      }
    }
  }

  return candidates;
};

AR.Detector.prototype.clockwiseCorners = function(candidates){
  var len = candidates.length, dx1, dx2, dy1, dy2, swap, i;

  for (i = 0; i < len; ++ i){
    dx1 = candidates[i][1].x - candidates[i][0].x;
    dy1 = candidates[i][1].y - candidates[i][0].y;
    dx2 = candidates[i][2].x - candidates[i][0].x;
    dy2 = candidates[i][2].y - candidates[i][0].y;

    if ( (dx1 * dy2 - dy1 * dx2) < 0){
      swap = candidates[i][1];
      candidates[i][1] = candidates[i][3];
      candidates[i][3] = swap;
    }
  }

  return candidates;
};

AR.Detector.prototype.notTooNear = function(candidates, minDist){
  var notTooNear = [], len = candidates.length, dist, dx, dy, i, j, k;

  for (i = 0; i < len; ++ i){
  
    for (j = i + 1; j < len; ++ j){
      dist = 0;
      
      for (k = 0; k < 4; ++ k){
        dx = candidates[i][k].x - candidates[j][k].x;
        dy = candidates[i][k].y - candidates[j][k].y;
      
        dist += dx * dx + dy * dy;
      }
      
      if ( (dist / 4) < (minDist * minDist) ){
      
        if ( CV.perimeter( candidates[i] ) < CV.perimeter( candidates[j] ) ){
          candidates[i].tooNear = true;
        }else{
          candidates[j].tooNear = true;
        }
      }
    }
  }

  for (i = 0; i < len; ++ i){
    if ( !candidates[i].tooNear ){
      notTooNear.push( candidates[i] );
    }
  }

  return notTooNear;
};

AR.Detector.prototype.findMarkers = function(imageSrc, candidates, warpSize){
  var markers = [], len = candidates.length, candidate, marker, i;

  for (i = 0; i < len; ++ i){
    candidate = candidates[i];

    CV.warp(imageSrc, this.homography, candidate, warpSize);
  
    CV.threshold(this.homography, this.homography, CV.otsu(this.homography) );

    marker = this.getMarker(this.homography, candidate);
    if (marker){
      markers.push(marker);
    }
  }
  
  return markers;
};

AR.Detector.prototype.getMarker = function(imageSrc, candidate){
  var width = (imageSrc.width / 7) >>> 0,
      minZero = (width * width) >> 1,
      bits = [], rotations = [], distances = [],
      square, pair, inc, i, j;

  for (i = 0; i < 7; ++ i){
    inc = (0 === i || 6 === i)? 1: 6;
    
    for (j = 0; j < 7; j += inc){
      square = {x: j * width, y: i * width, width: width, height: width};
      if ( CV.countNonZero(imageSrc, square) > minZero){
        return null;
      }
    }
  }

  for (i = 0; i < 5; ++ i){
    bits[i] = [];

    for (j = 0; j < 5; ++ j){
      square = {x: (j + 1) * width, y: (i + 1) * width, width: width, height: width};
      
      bits[i][j] = CV.countNonZero(imageSrc, square) > minZero? 1: 0;
    }
  }

  rotations[0] = bits;
  distances[0] = this.hammingDistance( rotations[0] );
  
  pair = {first: distances[0], second: 0};
  
  for (i = 1; i < 4; ++ i){
    rotations[i] = this.rotate( rotations[i - 1] );
    distances[i] = this.hammingDistance( rotations[i] );
    
    if (distances[i] < pair.first){
      pair.first = distances[i];
      pair.second = i;
    }
  }

  if (0 !== pair.first){
    return null;
  }

  return new AR.Marker(
    this.mat2id( rotations[pair.second] ), 
    this.rotate2(candidate, 4 - pair.second) );
};

AR.Detector.prototype.hammingDistance = function(bits){
  var ids = [ [1,0,0,0,0], [1,0,1,1,1], [0,1,0,0,1], [0,1,1,1,0] ],
      dist = 0, sum, minSum, i, j, k;

  for (i = 0; i < 5; ++ i){
    minSum = Infinity;
    
    for (j = 0; j < 4; ++ j){
      sum = 0;
      for (k = 0; k < 5; ++ k){
          sum += bits[i][k] === ids[j][k]? 0: 1;
      }

      if (sum < minSum){
        minSum = sum;
      }
    }

    dist += minSum;
  }

  return dist;
};

AR.Detector.prototype.mat2id = function(bits){
  var id = 0, i;
  
  for (i = 0; i < 5; ++ i){
    id <<= 1;
    id |= bits[i][1];
    id <<= 1;
    id |= bits[i][3];
  }

  return id;
};

AR.Detector.prototype.rotate = function(src){
  var dst = [], len = src.length, i, j;
  
  for (i = 0; i < len; ++ i){
    dst[i] = [];
    for (j = 0; j < src[i].length; ++ j){
      dst[i][j] = src[src[i].length - j - 1][i];
    }
  }

  return dst;
};

AR.Detector.prototype.rotate2 = function(src, rotation){
  var dst = [], len = src.length, i;
  
  for (i = 0; i < len; ++ i){
    dst[i] = src[ (rotation + i) % len ];
  }

  return dst;
};



///////////////////////

  //  AlloyLever.config({
  //     cdn:'//s.url.cn/qqun/qun/qqweb/m/qun/confession/js/vconsole.min.js',  
  //     reportUrl: "",  
  //     reportPrefix: 'qun',    
  //     reportKey: 'msg',       
  //     otherReport: {         
       
  //     },
  //     entry:"body"         
  //   })
  
    onload = ()=>{

      var stage = new cax.Stage(document.body.offsetWidth,document.body.offsetHeight,'body')
      
      console.log(stage.width,stage.height)
      var c = stage.canvas.getContext('2d')
  
      var detector
      
      var start_game = false
      var once = false
      

      var markers = []
  
      var scan_group = new cax.Group()
      stage.add(scan_group)
  
      var hole_group = new cax.Group()
      stage.add(hole_group)
  
  
      class BlackHole extends cax.Group {
        constructor(){
          super()
          
          this.hole = new cax.Bitmap(pic1)
          // 800 800 
          this.hole.originX = 400
          this.hole.originY = 400
          this.add(this.hole)
          
          this.default_scale = .25
          
          this.scale = this.default_scale
          
  
          this.scale = 0
  
          this.visible = false
          
        }
        run(){
          this.visible = true
  
          var that = this
          new TWEEN.Tween({scale:0})
          .easing(TWEEN.Easing.Quartic.InOut)
          .to({scale:this.default_scale+.43},2333)
          .onUpdate(function(){
            that.scale = this.scale
          })
          .onComplete(()=>{
            this.handle_expansion && this.handle_expansion()
          })
          .start()
  
          new TWEEN.Tween({rot:0})
          .easing(TWEEN.Easing.Linear.None)
          .to({rot:360},14333)
          .onUpdate(function(){
            that.rotation = this.rot
          })
          .repeat(Infinity)
          .start()
        }
        onExpansion(fn){
          this.handle_expansion = fn
        }
        update(){
  
        }
      }
  
      class Scan extends cax.Group {
        constructor(corners){
          super()
          
          this.corners = corners
  
          this.scan_bord = new cax.Graphics()
          this.add(this.scan_bord)
          this.scan_bord.alpha = 0
  
          this.scan_bord.shadow = {
            color: '#3beef7',
            offsetX: 0,
            offsetY: 0,
            blur: 10
          }
          this.scan_bord.beginPath()
          this.scan_bord.strokeStyle('white')
          this.scan_bord.fillStyle('rgba(0,255,255,.5)')
          this.scan_bord.lineWidth(2)
          
          // console.log(this.corners)
          // {143,76},{297,77},{298,194},{143,194}
          this.scan_bord.moveTo(this.corners[0].x, this.corners[0].y)
          
          for (let j = 1; j < this.corners.length; ++j) {
            let corner = this.corners[j]
            //this.clipPath.moveTo(corner.x, corner.y)
            
            //下个角
  
            this.scan_bord.lineTo(corner.x, corner.y)
  
          }
          this.scan_bord.closePath() 
          this.scan_bord.stroke()
          this.scan_bord.fill()
          
          
          this.minX = Math.min.apply(Math, this.corners.map(o=>o.x) )
          this.maxX = Math.max.apply(Math, this.corners.map(o=>o.x) )
          this.minY = Math.min.apply(Math, this.corners.map(o=>o.y) )
          this.maxY = Math.max.apply(Math, this.corners.map(o=>o.y) )
  
          this.cx = (this.minX+this.maxX)*.5
          this.cy = (this.minY+this.maxY)*.5
  
  
          this.fadeScanBord()
  
        }
        fadeOut(){
          var that = this
          new TWEEN.Tween({t:1})
          .easing(TWEEN.Easing.Linear.None)
          .to({t:0},433)
          .onUpdate(function(){
            that.scan_bord.alpha = this.t
          })
          .onComplete(()=>{})
          .start()
        }
        inThatTime(fn){
          this.handle_time = fn
        }
        fadeScanBord(){
          var that = this
          new TWEEN.Tween({t:0})
          .easing(TWEEN.Easing.Linear.None)
          .to({t:1},433)
          .onStart(()=>{
            setTimeout(()=>{
              this.handle_time&&this.handle_time()
            },433)
          })
          .onUpdate(function(){
            that.scan_bord.alpha = this.t
          })
          .repeat(3)
          .onComplete(()=>{
    
          })
          .start()
        }
  
      }
      
  
      var date_pic = new cax.Bitmap(pic2)
      stage.add(date_pic)
      
      //debugger
      // 573 423
      date_pic.originX = 573*.5
      date_pic.originY = 423*.5
      date_pic.default_scale = .5
      date_pic.scale = date_pic.default_scale
      date_pic.scale = 0
      date_pic.rotation = -720
  
      date_pic.outHole = function(fin={x:0,y:0}){
        var that = this
        var difx = 15-Math.random()*30
        // console.log(
        //   {scale:0,x:this.x,y:this.y,rotation:this.rotation}
        //   ,{scale:date_pic.default_scale,x:fin.x,y:fin.y,rotation:0}
        // );
        new TWEEN.Tween({scale:0,x:this.x,y:this.y,rotation:this.rotation})
        .to({scale:date_pic.default_scale,x:fin.x,y:fin.y,rotation:0},1666)
        //.easing(TWEEN.Easing.Quartic.InOut)
        .onUpdate(function(){
          that.scale = this.scale
          that.x = this.x + Math.sin(this.scale*Math.PI*2)*difx
          that.y = this.y
          that.rotation = this.rotation
        })
        .onComplete(()=>{
          this.handle_complete && this.handle_complete()
        })
        .start()
  
      }
      date_pic.onComplete=function(fn){
        this.handle_complete = fn
      }
  
  
  
      //date_pic.outHole({x:stage.width*.5,y:stage.height*.5})
  
      var O3O = new cax.Bitmap(pic3)
      stage.add(O3O)
      //600 498
      Object.assign(O3O,{
        originX: 600*.5
        ,originY: 498*.5
        ,scale: .2
        ,x: stage.width*.5
        ,y: stage.height - 493*.25*.6
        ,visible: false
        ,alpha:0
        ,fadeIn(delay=0){
          var that = this
          this.visible = true
          new TWEEN.Tween({alpha:0})
          .to({alpha:1},566)
          .delay(delay)
          .onUpdate(function(){
            that.alpha = this.alpha
          })
          .start()
        }
      })
  
      var blessing_text = new cax.Text('国庆节快乐O3O', {
        font: '35px Arial',
        color: 'white',
        baseline: 'middle',
        textAlign: 'center'
      })
      stage.add(blessing_text)
      blessing_text.shadow = {
        color: '#3beef7',
        offsetX: 0,
        offsetY: 0,
        blur: 10
      }
      Object.assign(blessing_text,{
        x:stage.width*.5
        ,y:60
        ,visible:false
        ,alpha:0
        ,fadeIn(delay=0){
          var that = this
          this.visible = true
          new TWEEN.Tween({alpha:0})
          .to({alpha:1},566)
          .delay(delay)
          .onUpdate(function(){
            that.alpha = this.alpha
          })
          .start()
  
        }
      })
  
  
      //date_pic.outHole({x:stage.width*.5,y:stage.height*.5})
  
      var drawCorners = (markers)=> {
        var corners, corner, i, j
  
        //for (i = 0; i < markers.length; ++i) {
          //某个标记的对象
          corners = markers[0].corners
          
          let scan = new Scan(corners)
          scan_group.add(scan)
          scan.inThatTime(()=>{
            let hole = new BlackHole()
            hole_group.add(hole)
            hole.x = scan.cx
            hole.y = scan.cy
          // console.log(hole,scan.cx,scan.cy);
            hole.run()
  
            hole.onExpansion(()=>{
              scan.fadeOut()
              
              date_pic.x = hole.x
              date_pic.y = hole.y
  
              
              date_pic.outHole({x:stage.width*.5,y:stage.height*.5})
  
              date_pic.onComplete(()=>{
                Object.assign(O3O,{
                  visible:true
                  ,y: date_pic.y + date_pic.originY*date_pic.scale + O3O.originY*O3O.scale*1.43
                })
                O3O.fadeIn(300)
  
                Object.assign(blessing_text,{
                  visible:true
                  ,y: date_pic.y - date_pic.originY*date_pic.scale - 60
                })
  
                console.log(blessing_text.y,O3O.y);
                
                blessing_text.fadeIn(600)
              })
  
  
            })
          })
  
         
          
        //}
      }
  
      
      navigator.mediaDevices.enumerateDevices().then(mediaDevices=>{
        var devices = []
  
        mediaDevices.forEach(mediaDevice => {
          if (mediaDevice.kind === 'videoinput') {  
            //deviceId,label
            devices.push(mediaDevice)
          }
        })
        
        console.log(`devices:${devices}`)
        navigator.mediaDevices.getUserMedia({
          video: {
            deviceId:{exact: devices[devices.length-1].deviceId}
          },
          audio: false
        })
        .then(stream => {
  
          video.src =  window.URL.createObjectURL(stream)
  
          detector = new AR.Detector()
  
        })
        .catch(e => {
          console.log(e)
        });
  
      })
      .catch(e=>{
        console.log(e)
      })
  
  
      
  
      /////////////
     
      ////////////
      
        
      var scan_line_y = -60
      
      var scan_line_tw = new TWEEN.Tween({y:-60})
      .to({y:stage.height+60},2888)
      .easing(TWEEN.Easing.Linear.None)
      .onUpdate(function(){
        scan_line_y = this.y
      })
      .repeat(Infinity)
      .start()
      
      // debugger
  
      cax.tick(()=>{
        stage.update()
        TWEEN.update()
        
        if(once) return
  
        if(start_game ){
          once = true
          //start_game = false
          // MoonGame.start()
          drawCorners(markers)
          return
        }
  
        if(video.HAVE_ENOUGH_DATA && detector){
          c.drawImage(video, 0, 0, stage.width, stage.height)
          let imageData = c.getImageData(0, 0, stage.width, stage.height)
          // console.log(`imageData.width:${imageData.width}`);
  
          c.clearRect(0,0, stage.width, stage.height)
  
          markers = detector.detect(imageData)
          if(markers.length > 0) {
            start_game = true
  
            scan_line_tw.stop()
          }
        }
        
        
        {
          c.save()
          c.globalAlpha = 1
          c.translate(0,scan_line_y)
          c.lineWidth = 2
          
          c.shadowColor = '#3beef7'
          c.shadowOffsetY = 0
          c.shadowOffsetX = 0
          c.shadowBlur = 10
  
          c.strokeStyle = 'white'
          c.beginPath()
          c.moveTo(0,0)
          c.lineTo(stage.width,0)
          c.closePath()
          c.stroke()
          c.restore()
        }
        
      })
    }
      