(function () {
  "use strict";

  /* ============ waveform canvas ============ */
  var canvas = document.getElementById("pcg");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;
  var clock = 0;            // seconds of trace elapsed
  var lastT = 0;
  var running = true;

  var BEAT = 60 / 73;       // ~73 bpm

  function resize() {
    var r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---- phonocardiogram synthesis -------------------------------------
     A real PCG has two clearly separated bursts per cycle:
       S1 (lub) around the QRS, low & broad
       S2 (dub) at end of systole, higher & tighter
     Between them the trace is nearly flat. We model each burst as a
     damped sinusoid with a short noise component.                        */
  function burst(dt, decay, freq, amp) {
    if (dt < 0) return 0;
    var env = Math.exp(-dt / decay);
    if (env < 0.004) return 0;
    return amp * env * Math.sin(dt * freq * Math.PI * 2);
  }

  function pcg(t) {
    var p = ((t % BEAT) + BEAT) % BEAT;
    var v = 0;
    v += burst(p - 0.045, 0.040, 52, 1.00);   // S1 fundamental
    v += burst(p - 0.045, 0.022, 104, 0.30);  // S1 harmonic
    v += burst(p - 0.315, 0.030, 82, 0.62);   // S2 fundamental
    v += burst(p - 0.315, 0.016, 158, 0.20);  // S2 harmonic
    return v;
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = "rgba(134,191,169,0.075)";
    ctx.lineWidth = 1;
    var step = 44;
    for (var x = 0; x < W; x += step) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke();
    }
    for (var y = 0; y < H; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(233,163,59,0.16)";
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawGrid();

    var mid = H / 2;
    var amp = H * 0.30;
    // ~2.4 cardiac cycles visible across the width
    var pxPerSec = W / (BEAT * 2.4);

    ctx.lineWidth = 1.8;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    var grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "rgba(233,163,59,0.05)");
    grad.addColorStop(0.30, "rgba(233,163,59,0.35)");
    grad.addColorStop(0.72, "rgba(233,163,59,0.85)");
    grad.addColorStop(1, "#F3C67C");
    ctx.strokeStyle = grad;
    ctx.shadowColor = "rgba(233,163,59,0.5)";
    ctx.shadowBlur = 10;

    ctx.beginPath();
    for (var x = 0; x <= W; x += 1) {
      var t = clock - (W - x) / pxPerSec;
      var y = mid - pcg(t) * amp;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // leading sample dot
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#FFD79A";
    ctx.beginPath();
    ctx.arc(W - 2, mid - pcg(clock) * amp, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  var rafId = null;
  function loop(ts) {
    if (!lastT) lastT = ts;
    var dt = Math.min(0.06, (ts - lastT) / 1000);
    lastT = ts;
    if (running) clock += dt;
    render();
    rafId = requestAnimationFrame(loop);
  }

  window.addEventListener("resize", function () { resize(); render(); }, { passive: true });

  resize();
  clock = 6.0;   // start mid-trace so the waveform is fully populated on load

  if (reduce) {
    running = false;
    render();
  } else {
    rafId = requestAnimationFrame(loop);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && rafId === null) {
            lastT = 0;
            rafId = requestAnimationFrame(loop);
          } else if (!e.isIntersecting && rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
        });
      }, { threshold: 0 }).observe(canvas);
    }
  }

  /* ============ heartbeat audio ============ */
  var actx = null;
  var btn = document.getElementById("playBtn");
  var txt = document.getElementById("playTxt");

  function thump(t0, f0, f1, decay, amp, type) {
    var o = actx.createOscillator();
    var g = actx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f1, t0 + decay);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(amp, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    o.connect(g);
    g.connect(actx.destination);
    o.start(t0);
    o.stop(t0 + decay + 0.05);
  }

  function noiseBurst(t0, decay, amp) {
    var len = Math.floor(actx.sampleRate * decay);
    var buf = actx.createBuffer(1, len, actx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    }
    var src = actx.createBufferSource();
    src.buffer = buf;
    var bp = actx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 110;
    bp.Q.value = 0.9;
    var g = actx.createGain();
    g.gain.value = amp;
    src.connect(bp); bp.connect(g); g.connect(actx.destination);
    src.start(t0);
  }

  function play() {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
      var t = actx.currentTime + 0.08;
      for (var b = 0; b < 4; b++) {
        var t0 = t + b * BEAT;
        // S1
        thump(t0, 58, 34, 0.17, 0.30);
        noiseBurst(t0, 0.10, 0.10);
        // S2
        thump(t0 + BEAT * 0.37, 76, 44, 0.12, 0.16);
        noiseBurst(t0 + BEAT * 0.37, 0.07, 0.05);
      }
      btn.classList.add("playing");
      txt.textContent = "正在播放";
      setTimeout(function () {
        btn.classList.remove("playing");
        txt.textContent = "播放心音";
      }, 4200);
    } catch (err) {
      txt.textContent = "设备不支持音频";
    }
  }

  if (btn) btn.addEventListener("click", play);

  /* ============ reveal on scroll ============ */
  var items = document.querySelectorAll(".rv");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add("in"); });
  }
})();
