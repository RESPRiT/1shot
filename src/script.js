//----------------------------------------------//
// this codebase will be an omni-file because I //
// do not anticipate it being that big anyways  //
//----------------------------------------------//

//-------
// Notes
// - Let's just assume that the full range of any normal distribution is 3.5 std devs (in one direction, so 7 std devs across the entire distribution)

//--------------
// Some TO-DOs:
// - Body/head shots
// - Aim punch AND recoil
// - Gun attributes (semi-auto spread, gun accuracy/bloom, reload time, clip size, first-shot accuracy, etc.)
// - Cowboy health/hp
// - Dodging (???)

import { interpolateCividis, interpolateCool, interpolateMagma, interpolateRdYlGn, interpolateTurbo, interpolateViridis, interpolateWarm } from 'd3-scale-chromatic';
import _ from 'lodash';
import seedrandom from 'seedrandom';
import gaussian from 'gaussian'; // Documentation: https://github.com/errcw/gaussian

//-----------
// Constants
const MAX_SD = 3.5;
const rng_seed = 'hello';
const get_random = new seedrandom(rng_seed);

//---------------
// Shooter Class
class Cowboy {
  /**
   * Individual Properties
   * @param {string} name it's a name
   * @param {number} width "w" in Fitts's Law, made up units
   * 
   * Shooting Properties
   * @param {number} delay "a" in Fitts's Law, seconds
   * @param {number} acceleration "b" in Fitts's Law, made up units
   * @param {number} error desired error/accuracy, %: [0-1]
   * @param {number} consistency variance of error; ideal range: [0-50]
   */
  constructor(name, width=2, delay=0.250, acceleration=10, error=0.5, consistency=0) {
    this.name = name;

    this.width = width;

    this.delay = delay;
    this.acceleration = 1 / acceleration; // units needs to be inversed
    this.error = error;
    this.consistency = consistency;
  }

  /**
   * Samples a value from the W_e distribution.
   * @param {Cowboy} target who we shootin'???
   * @param {number} distance how far away is the target?
   * @returns {object} shot information: {
   *   pos: position of the shot relative to center of target,
   *   time: time it took to fire the shot,
   *   hit: did the shot hit?
   * }
   */
  shoot(target, distance=10) {
    const w_e_dist = this.get_w_e_distribution(target);
    const pos = capped_sample(w_e_dist);
    const time = this.calc_shot_speed(w_e_dist, distance);
    // TODO: this will need to be reworked a bit for headshots/bodyshots
    const hit = Math.abs(pos) <= target.width / 2;

    return { pos, time, hit };
  }

  /**
   * Uses Fitts's Law to calculate shot speed (MT).
   * @param {gaussian} w_e_dist w_e distribution of shot
   * @param {number} distance how far is the target?
   * @param {boolean} delay_variance whether or not to add a small amount
   *                                 of variance to delays (resolves ties)
   * @returns {number} shot speed, lower-bound is 100ms
   */
  calc_shot_speed(w_e_dist, distance, delay_variance=true) {
    const w_e = w_e_dist.standardDeviation * MAX_SD;

    let curr_delay = this.delay;

    if(delay_variance) {
      // give some variance to reaction time, why not
      // 0.001 is an arbitrary value that just seems to give a good spread
      // EDIT: I calculated my personal variance and it turns out I was off by a magnitude
      // 0.0001 is a more realistic value (the value I calced for myself was 0.00012)
      const delay_dist = gaussian(this.delay, 0.0001);
      // 100ms seems like a reasonable lower-bound
      curr_delay = Math.max(delay_dist.ppf(get_random()), 0.100);
    }

    // if distance is less than half of the width_error, then you're
    // already on target, so shot speed is just reaction time (delay)
    // [later note] this is a kind of reasonable, kind of weird assumption
    //      to make, but it's easier than trying to dynamically change w_e
    if(distance <= w_e / 2) {
      return curr_delay;
    }

    return curr_delay + this.acceleration * Math.log2(2 * distance / w_e);
  }

  /**
   * Calculate normal distribution for Width_error. In other words, the
   * normal distribution where `error`% of outcomes are within `targetWidth`.
   * @param {Cowboy} target the width of the target; the "success" range
   * @returns {gaussian} the Width_error distribution
   */
  get_w_e_distribution(target) {
    let curr_error;

    if(this.consistency == 0) {
      curr_error = this.error;
    } else {
      // Generate `errorDist` with mean = `error` and variance = `consistency`
      const error_dist = gaussian(this.error, this.consistency / 1000);
      
      // Sample a value `curr_error` from `errorDist`
      // ^- This how we add randomness (or none if `consistency` == 0)
      curr_error = error_dist.ppf(get_random());
    }
    
    if(curr_error <= 0) {
      curr_error = 0.01;
    } else if(curr_error >= 1) {
      curr_error = 0.99;
    }

    // Use `inverse_normal()` to compute the std dev (and, by-proxy, var) of the Width_error distribution
    // ^- Don't forget to scale the distribution based on `targetWidth`
    // ^- And don't forget that the distribution is 2-tailed
    let one_tail_error = curr_error / 2; // assuming equal error on both sides of the distribution
    const z_score = inverse_normal(0.5 + one_tail_error);

    const std_dev = (target.width / 2) / z_score;

    // Generate and return gaussian object for the W_e distribution
    // ^- Alternatively, returns a sample from the distribution
    const w_e_dist = gaussian(0, std_dev * std_dev);
    return w_e_dist;

    // Sanity Check Test Case
    // If `targetWidth` = 2, `error` = 0.5, and `consistency` = 0:
    // w_e_dist.cdf(1) ~= 0.75
    // w_e_dist.cdf(0) ~= 0.50
    // w_e_dist.cdf(-1) ~= 0.25
  }
}


//------------------
// Helper Functions

/**
 * Stolen From: https://stackoverflow.com/questions/8816729/javascript-equivalent-for-inverse-normal-function-eg-excels-normsinv-or-nor
 * Basically an inverse z-table, frankly an eyesore
 * @param {number} p (1-tailed) probability of a random value being smaller
 * @returns {number} the corresponding z (std dev) value
 */
function inverse_normal(p) {
    var a1 = -39.6968302866538, a2 = 220.946098424521, a3 = -275.928510446969;
    var a4 = 138.357751867269, a5 = -30.6647980661472, a6 = 2.50662827745924;
    var b1 = -54.4760987982241, b2 = 161.585836858041, b3 = -155.698979859887;
    var b4 = 66.8013118877197, b5 = -13.2806815528857, c1 = -7.78489400243029E-03;
    var c2 = -0.322396458041136, c3 = -2.40075827716184, c4 = -2.54973253934373;
    var c5 = 4.37466414146497, c6 = 2.93816398269878, d1 = 7.78469570904146E-03;
    var d2 = 0.32246712907004, d3 = 2.445134137143, d4 = 3.75440866190742;
    var p_low = 0.02425, p_high = 1 - p_low;
    var q, r;
    var retVal;

    if ((p < 0) || (p > 1))
    {
        alert("NormSInv: Argument out of range.");
        retVal = 0;
    }
    else if (p < p_low)
    {
        q = Math.sqrt(-2 * Math.log(p));
        retVal = (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    }
    else if (p <= p_high)
    {
        q = p - 0.5;
        r = q * q;
        retVal = (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q / (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
    }
    else
    {
        q = Math.sqrt(-2 * Math.log(1 - p));
        retVal = -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    }

    return retVal;
}

/**
 * Samples from a given distribution but caps results within MAX_SD.
 * @param {gaussian} dist distribution to sample from
 * @returns {number} capped sample value
 */
function capped_sample(dist) {
  const std_dev = dist.standardDeviation;
  const cap = std_dev * MAX_SD;

  let sample = dist.ppf(get_random());
  if(sample > cap) {
    sample = cap;
  } else if(sample < -cap) {
    sample = -cap;
  }

  return sample;
}


//------------------------------------
// Simulation/Duel-Handling Functions

/**
 * Handles shots back and forth until someone dies.
 * @param {Cowboy} cowboy_a
 * @param {Cowboy} cowboy_b
 * @returns {object} results: {
 *   winner: name of winner,
 *   shot_timeline: [{
 *     shooter: name of who shot,
 *     time: time in the timeline when the shot was taken,
 *     pos: position of shot relative to target,
 *     hit: result of the shot
 *   }, ...]
 * }
 */
function simulate_duel(cowboy_a, cowboy_b, distance=100) {
  let shot_timeline = [];
  let winner;

  let is_turn_a = false;
  let is_over = false;

  let distance_a = distance;
  let distance_b = distance

  let shot_a = cowboy_a.shoot(cowboy_b, distance_a);
  let shot_b = cowboy_b.shoot(cowboy_a, distance_b);

  // Initialize counters for both cowboys, set to initial shot speed
  let counter_a = shot_a['time'];
  let counter_b = shot_b['time'];

  let infinity_check = 0; // debug
  while(!is_over && infinity_check < 1000) {
    infinity_check++;

    // Check which counter is smaller
    if(counter_a == counter_b) {
      is_turn_a = Math.round(Math.random());
    } else {
      is_turn_a = counter_a < counter_b;
    }
    //is_turn_a = counter_a <= counter_b;

    // TODO: clean-up repeated code
    if(is_turn_a) {
      shot_timeline.push({
        shooter: cowboy_a['name'],
        time: counter_a,
        pos: shot_a['pos'],
        hit: shot_a['hit']
      });

      counter_a += shot_a['time'];
      distance_a = Math.abs(shot_a['pos']);
      is_over = shot_a['hit'];
      if(is_over) winner = cowboy_a['name'];
      
      shot_a = cowboy_a.shoot(cowboy_b, distance_a);
    } else {
      shot_timeline.push({
        shooter: cowboy_b['name'],
        time: counter_b,
        pos: shot_b['pos'],
        hit: shot_b['hit']
      });
      
      counter_b += shot_b['time'];
      distance_b = Math.abs(shot_b['pos']);
      is_over = shot_b['hit'];
      if(is_over) winner = cowboy_b['name'];
      
      shot_b = cowboy_b.shoot(cowboy_a, distance_b);
    }
  }
  return { winner, shot_timeline };
}

/**
 * Handles running multiple simulations. It's just a for-loop.
 * @param {Cowboy} cowboy_a who up?
 * @param {Cowboy} cowboy_b who up, too?
 * @param {number} distance how far?
 * @param {number} n_trials how many times?
 * @returns {object} results of the simulations: {
 *   winners: object where keys are names and values are wins,
 *   timelines: array of every simulation timeline
 * }
 */
function batch_sim(cowboy_a, cowboy_b, distance=100, n_trials=1000) {
  let results = {
    winners: {},
    timelines: []
  };

  for(let i = 0; i < n_trials; i++) {
    const duel_result = simulate_duel(cowboy_a, cowboy_b, distance);
    const winner = duel_result['winner'];
    const timeline = duel_result['shot_timeline'];

    if(results['winners'][winner]) {
      results['winners'][winner]++;
    } else {
      results['winners'][winner] = 1;
    }

    results['timelines'].push(timeline);
  }

  return results;
}

/**
 * Runs batches to create a 2x2 grid for the error variable
 * @param {number array} width 
 * @param {number array} delay 
 * @param {number array} acceleration 
 * @param {number array} distance 
 * @param {number} n_trials 
 * @returns {array} 2x2 array of arlo error vs. bob error;
 *                  arlo = y-axis, bob = x-axis
 */
function batch_error_2x2(increment=0.05, lower_bound=0.05, upper_bound=1.00, n_trials=1000, width=[2], delay=[0.250], acceleration=[20], distance=5) {
  let results_grid = [];
  let trials_grid = [];
  let mean_trials_grid = [];

  for(let error_a = lower_bound; error_a <= upper_bound + 0.001; error_a += increment) {
    let curr_row = [];
    let curr_row_trials = [];
    let curr_row_mean_trials = []

    for(let error_b = lower_bound; error_b <= upper_bound + 0.001; error_b += increment) {
      let width_a = width[0];
      let delay_a = delay[0];
      let acceleration_a = acceleration[0];
      let width_b = width.length > 1 ? width[1] : width_a;
      let delay_b = delay.length > 1 ? delay[1] : delay_a;
      let acceleration_b = acceleration.length > 1 ? acceleration[1] : acceleration_a;
      
      let arlo = new Cowboy('Arlo', width_a, delay_a, acceleration_a, error_a);
      let bob = new Cowboy('Bob', width_b, delay_b, acceleration_b, error_b);

      let sim = batch_sim(arlo, bob, distance, n_trials);

      curr_row.push(sim['winners']['Arlo'] / n_trials);
      curr_row_trials.push(sim);

      let timelines = sim['timelines'];
      let mean_shots = 0;
      for(let trial of timelines) {
        mean_shots += trial.length;
      }
      mean_shots /= timelines.length;
      curr_row_mean_trials.push(mean_shots);
    }

    results_grid.push(curr_row);
    trials_grid.push(curr_row_trials);
    mean_trials_grid.push(curr_row_mean_trials);
  }

  return {results_grid, trials_grid, mean_trials_grid};
}

//-------------------
// Testing Functions

/**
 * Samples shots and puts the results in integer bins.
 * @param {gaussian} dist W_e distribution to sample from
 * @returns an object whose keys are integers and values are counts
 */
function bin_distribution(dist) {
  let bins = {};

  for(let i = 0; i < 1000; i++) {
    const sample = dist.ppf(get_random());
    const rounded_sample = Math.round(sample);

    if(!bins[rounded_sample]) {
      bins[rounded_sample] = 1;
    } else {
      bins[rounded_sample]++;
    }
  }

  return bins;
}

/**
 * Samples shots and puts the results in integer bins.
 * @param {Cowboy} shooter Who's shootin'???
 * @param {Cowboy} target Who's dyin'???
 * @returns an object whose keys are integers and values are counts
 */
function bin_cowboy(shooter, target, distance=10, n_trials=1000) {
  let bins = {};
  bins[true] = 0;
  bins[false] = 0;

  for(let i = 0; i < n_trials; i++) {
    const sample = shooter.shoot(target);
    const sample_pos = sample['pos'];
    const rounded_sample = Math.round(sample_pos);

    if(!bins[rounded_sample]) {
      bins[rounded_sample] = 1;
    } else {
      bins[rounded_sample]++;
    }

    const sample_result = sample['hit'];
    bins[sample_result]++;
  }

  return bins;
}

//---------------------
// Rendering Functions

/**
 * Renders a given 2x2 results grid as a 2x2 gradient in canvas, then
 * adds it to the DOM as an <img> element.
 * @param {*} arr 
 * @param {*} increment 
 * @param {*} lower_bound 
 * @param {*} upper_bound 
 * @param {*} size 
 * @param {*} gap 
 * @param {*} font_scale 
 */
function draw_2x2(arr, increment, lower_bound, upper_bound, size=50, gap=1.2, font_scale=0.5) {
  let canvas = document.getElementById('canvas');
  let ctx = canvas.getContext('2d');

  canvas.width = size * gap * ((upper_bound - lower_bound) / increment + 1) + size * 4;
  canvas.height = size * gap * ((upper_bound - lower_bound) / increment) + size * 5;

  ctx.globalCompositeOperation = 'destination-over';
  ctx.clearRect(0,0,canvas.width,canvas.height); // clear canvas

  // values
  let font_stroke = size / 12.5;
  let start_x = size * 2;
  let start_y = size * 2;
  let pos_x = start_x;
  let pos_y = start_y;
  let is_decimal = Math.max(...arr[0]) <= 1;

  // draw x-axis
  if(font_scale) {
    let x_axis_pos = size * 2;
    for(let x = upper_bound; x >= lower_bound - 0.001; x -= increment) {
      ctx.textAlign = 'center';
      let text_x = x_axis_pos + size / 2;
      let text_y = size * 1.75;
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = font_stroke * 0.75;
      ctx.font = 'italics' + size * font_scale * 0.75 + 'px Arial';
      ctx.fillText(x + '%', text_x, text_y);
      ctx.strokeText(x + '%', text_x, text_y);

      x_axis_pos += size * gap;
    }
  }

  // draw y-axis
  if(font_scale) {
    let y_axis_pos = size * 2;
    for(let y = upper_bound; y >= lower_bound - 0.001; y -= increment) {
      ctx.textAlign = 'right';
      let text_x = size * 1.75;
      let text_y = y_axis_pos + size / 2 + size * font_scale * 0.75 / 4;
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = font_stroke * 0.75;
      ctx.font = 'italics' + size * font_scale * 0.75 + 'px Arial';
      ctx.fillText(y + '%', text_x, text_y);
      ctx.strokeText(y + '%', text_x, text_y);

      y_axis_pos += size * gap;
    }
  }

  // draw title
  if(false) {
    let title_x = start_x + (arr[0].length * size * gap - size * (gap - 1)) / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = font_stroke;
    ctx.font = 'bold italic ' + size * font_scale * 1.25 + 'px Arial';
    ctx.fillText('Arlo vs. Bob: Accuracy', title_x, size * 1.25);
  }

  // draw grid
  let grid_max = Math.max(...arr.map(row => Math.max(...row)));

  for(let y = arr.length - 1; y >= 0; y--) {
    let row = arr[y];

    for(let x = row.length - 1; x >= 0; x--) {
      let value = row[x];
      let color = is_decimal ? interpolateRdYlGn(value) : interpolateRdYlGn(value / grid_max);

      // draw text label for square
      ctx.textAlign = 'center';
      let text_x = pos_x + size / 2;
      let text_y = pos_y + size / 2 + size * font_scale / 3;
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'rgb(10, 10, 10)';
      ctx.lineWidth = font_stroke;
      ctx.font = 'bold ' + size * font_scale + 'px Arial';
      ctx.fillText(is_decimal ? Math.round(value * 100) : value.toFixed(1), text_x, text_y);
      ctx.strokeText(is_decimal ? Math.round(value * 100) : value.toFixed(1), text_x, text_y);
      
      // draw square
      ctx.fillStyle = color;
      ctx.fillRect(pos_x, pos_y, size, size);

      pos_x += size * gap;
    }

    // draw means
    let text_x = pos_x + size / 4;
    let text_y = pos_y + size / 2 + size * font_scale / 3;
    ctx.textAlign = 'left';
    ctx.font = 'bold italic ' + size * font_scale + 'px Arial';
    // hellish float handling
    let row_mean = _.mean(row).toFixed(3);
    ctx.fillStyle = interpolateRdYlGn(row_mean);
    let scaled_mean = is_decimal ? Math.round(row_mean * 1000) / 10 : Number(row_mean).toFixed(1);
    ctx.fillText(is_decimal ? scaled_mean + '%' : scaled_mean, text_x, text_y);

    pos_x = start_x;
    pos_y += size * gap;
  }

  // put it in an image
  let canvas_img = document.createElement('img');
  let canvas_img_src = canvas.toDataURL('img/png');
  canvas_img.src = canvas_img_src;
  document.getElementById('imgs').appendChild(canvas_img);
}

//----------------
// Data Functions

function query_grid(grid, row, col) {
  let curr_trials = grid[row][col];

  let winners = curr_trials['winners'];
  let timelines = curr_trials['timelines'];
  let timeline_lengths = timelines.map(trial => trial.length);

  let mean_shots = 0;
  for(let trial of timelines) {
    mean_shots += trial.length;
  }
  mean_shots /= timelines.length;

  console.log(mean_shots);
}

//---------------
// Main Function
function main() {
  let size = 60;
  let gap = 1;
  let text_scale = 0.4;
  let increment = 0.05;
  let lower_bound = 0.05;
  let upper_bound = 1.00;
  let n_trials = 2000;
  let width = [1]; // Array size 2 to specify asymmetrical scenarios
  let delay = [0.200]; // 0.200-0.250 is "average"; 0.150-0.200 is "very good"
  let acceleration = [10]; // 20 is about "average"; 50-60 is "upper bound"
  let distance = 3; // 3 is about "good xhair placement" distance; 30 is about "decent flick"

  let error_2x2 = batch_error_2x2(increment, lower_bound, upper_bound, n_trials, width, delay, acceleration, distance);
  console.log(error_2x2.trials_grid);
  draw_2x2(error_2x2.results_grid, increment * 100, lower_bound * 100, upper_bound * 100, size, gap, text_scale);

  let error_2x2b = batch_error_2x2(increment, lower_bound, upper_bound, n_trials, width, delay, [20], distance);
  console.log(error_2x2b.trials_grid);
  draw_2x2(error_2x2b.results_grid, increment * 100, lower_bound * 100, upper_bound * 100, size, gap, text_scale);
  
  draw_2x2(error_2x2.results_grid, increment * 100, lower_bound * 100, upper_bound * 100, size, gap, 0);
  draw_2x2(error_2x2b.results_grid, increment * 100, lower_bound * 100, upper_bound * 100, size, gap, 0);
  draw_2x2(error_2x2.mean_trials_grid, increment * 100, lower_bound * 100, upper_bound * 100, size, gap, text_scale);
  query_grid(error_2x2.trials_grid, 18, 0);

  /**
   * 1b) Same as 1a but not instant, small variance on things like error
   */

  /**
   * 2) Head shots and body shots (+HP)
   */

  /**
   * 3) Tons of gun stuff
   */
}

// Go
main();