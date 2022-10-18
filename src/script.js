//------------------------------------------------------------------------------------------//
// this codebase will be an omni-file because I do not anticipate it being that big anyways //
//------------------------------------------------------------------------------------------//

//------------------
// Scratch
// - Let's just assume that the full range of any normal distribution is 3.5 std devs
// - Also, it's probably easier to just use normalized normal distributions (3.5 std dev = 0.5)

import gaussian from 'gaussian'; // Documentation: https://github.com/errcw/gaussian
import NormalDistribution from 'normal-distribution';

// Shooter Class
class Cowboy {
  /**
   * Individual Properties
   * @param {string} name it's a name
   * @param {number} width "w" in Fitts's Law
   * 
   * Shooting Properties
   * @param {number} delay "a" in Fitts's Law
   * @param {number} acceleration "b" in Fitts's Law
   * @param {number} error desired error/accuracy
   * @param {number} consistency variance of error; ideal range: [~0-50]
   */
  constructor(name, width=2, delay=1, acceleration=1, error=0.5, consistency=0) {
    this.name = name;

    this.width = width;

    this.delay = delay;
    this.acceleration = acceleration; 
    this.error = error;
    this.consistency = consistency;
  }

  /**
   * Samples a value from the W_e distribution.
   * @param {Cowboy} target who we shootin'???
   * @returns {number} position of the shot relative to center of target
   */
  shoot(target) {
    const w_e_dist = this.get_w_e_distribution(target);
    return capped_sample(w_e_dist);
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
      const errorDist = gaussian(this.error, this.consistency / 1000);
      
      // Sample a value `curr_error` from `errorDist`
      // ^- This how we add randomness (or none if `consistency` == 0)
      curr_error = errorDist.ppf(Math.random());
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
    // w_eDist.cdf(1) ~= 0.75
    // w_eDist.cdf(0) ~= 0.50
    // w_eDist.cdf(-1) ~= 0.25
  }
}

// Helpers
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

function capped_sample(dist) {
  const std_dev = dist.standardDeviation;
  const cap = std_dev * 3.5; // arbitrary

  let sample = dist.ppf(Math.random());
  if(sample > cap) {
    sample = cap;
  } else if(sample < -cap) {
    sample = -cap;
  }

  return sample;
}

// Simulation/Duel-Handling Functions
/**
 * Handles shots back and forth until someone dies.
 * @param {Cowboy} cowboy_a
 * @param {Cowboy} cowboy_b
 */
function simulateDuel() {
  // Initialize counters for both cowboys, set to initial shot speed
  // Check which counter is smaller
  // Call `simulateShot` for the smaller counter
  // If someone died: duel is over
  // Else: Increment smaller counter by shot speed
  // Repeat Step 2


  // TODO: Write to Timeline data object, something like:
  // timeline = [{shooter, shot_time, shot_position, shot_outcome}, ...]
}

/**
 * Handles figuring out what happens after someone takes a shot.
 * Basically, applying Fitts's Law to the shot to calculate shot position.
 * @param {Cowboy} shooter
 * @param {number} start_pos
 * @returns {object} outcome in the form: {end_pos, result}
 */
function simulateShot() {

}

/**
 * Handles running multiple simulations. It's just a for-loop.
 */
function batchSimulation(n_trials, cowboy_a, cowboy_b) {

}

// Testing Functions
/**
 * Samples shots and puts the results in integer bins.
 * @param {gaussian} dist W_e distribution to sample from
 * @returns an object whose keys are integers and values are counts
 */
function bin_distribution(dist) {
  let bins = {};

  for(let i = 0; i < 1000; i++) {
    const sample = dist.ppf(Math.random());
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
function bin_cowboy(shooter, target, n_trials=1000) {
  let bins = {};

  for(let i = 0; i < n_trials; i++) {
    const sample = shooter.shoot(target);
    const rounded_sample = Math.round(sample);

    if(!bins[rounded_sample]) {
      bins[rounded_sample] = 1;
    } else {
      bins[rounded_sample]++;
    }
  }

  return bins;
}

// Main Function
function main() {
  let arlo = new Cowboy("Arlo", 2, 1, 1, 0.5, 0);
  let bob = new Cowboy("Bob", 2, 1, 1, 0.5, 0);

  console.log(bin_cowboy(arlo, bob));
}

// Go
main();