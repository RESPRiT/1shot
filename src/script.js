//----------------------------------------------//
// this codebase will be an omni-file because I //
// do not anticipate it being that big anyways  //
//----------------------------------------------//

//-------
// Notes
// - Let's just assume that the full range of any normal distribution is 3.5 std devs (in one direction, so 7 std devs across the entire distribution)

import gaussian from 'gaussian'; // Documentation: https://github.com/errcw/gaussian

//-----------
// Constants
const MAX_SD = 3.5;

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
   * @returns {number} shot speed, lower-bound is 100ms
   */
  calc_shot_speed(w_e_dist, distance, delay_variance=false) {
    const w_e = w_e_dist.standardDeviation * MAX_SD;

    let curr_delay = this.delay;

    if(delay_variance) {
      // give some variance to reaction time, why not
      // 0.001 is an arbitrary value that just seems to give a good spread
      const delay_dist = gaussian(this.delay, 0.001);
      // 100ms seems like a reasonable lower-bound
      curr_delay = Math.max(delay_dist.ppf(Math.random()), 0.100);
    }

    // if distance is less than half of the width_error, then you're
    // already on target, so shot speed is just reaction time (delay)
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
      curr_error = error_dist.ppf(Math.random());
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

  let sample = dist.ppf(Math.random());
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
    is_turn_a = counter_a <= counter_b;

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
function batch_sim(cowboy_a, cowboy_b, distance, n_trials=1000) {
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

//---------------
// Main Function
function main() {
  /**
   * 1) Base Case, 50/50 Case
   * Both cowboys have:
   * - Normal width (2u)
   * - Normal delay (250ms)
   * - "Instant" acceleration (99999)
   * - Perfect consistency (0)
   * 
   * Arlo has:
   * - "100%" desired error
   * 
   * Bob has:
   * - 50% desired error
   */
  let arlo = new Cowboy("Arlo", 2, 0.250, 99999, 0.999, 0);
  let bob = new Cowboy("Bob", 2, 0.250, 99999, 0.50, 0);
  console.log(batch_sim(arlo, bob, 100, 10000)); // 50/50 outcome

  let arlo2 = new Cowboy("Arlo", 2, 0.250, 99999, 0.55, 0);
  let bob2 = new Cowboy("Bob", 2, 0.250, 99999, 0.45, 0);
  console.log(batch_sim(arlo2, bob2, 100, 10000)); // 40/60 outcome

  let arlo3 = new Cowboy("Arlo", 2, 0.250, 99999, 0.65, 0);
  let bob3 = new Cowboy("Bob", 2, 0.250, 99999, 0.35, 0);
  console.log(batch_sim(arlo3, bob3, 100, 10000)); // 55/45 outcome
  
  let arlo4 = new Cowboy("Arlo", 2, 0.250, 99999, 0.75, 0);
  let bob4 = new Cowboy("Bob", 2, 0.250, 99999, 0.25, 0);
  console.log(batch_sim(arlo4, bob4, 100, 10000)); // 70/30 outcome
}

// Go
main();