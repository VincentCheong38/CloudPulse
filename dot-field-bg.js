/**
 * Vanilla port of React Bits "Dot Field" (https://reactbits.dev/backgrounds/dot-field)
 * MIT — original: https://github.com/DavidHDev/react-bits
 */
(function dotFieldBackground() {
  var TWO_PI = Math.PI * 2;

  function boot() {
    if (document.getElementById("dot-field-bg")) return;

    var reduced =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var root = document.createElement("div");
    root.id = "dot-field-bg";
    root.setAttribute("aria-hidden", "true");

    var inner = document.createElement("div");
    inner.className = "dot-field-inner";

    var canvas = document.createElement("canvas");
    canvas.className = "dot-field-canvas";

    var glowId = "dot-field-glow-" + Math.random().toString(36).slice(2, 9);
    var glowColor = "#060b17";

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "dot-field-svg");
    var defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    var radGrad = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
    radGrad.setAttribute("id", glowId);
    var stop0 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop0.setAttribute("offset", "0%");
    stop0.setAttribute("stop-color", glowColor);
    var stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop1.setAttribute("offset", "100%");
    stop1.setAttribute("stop-color", "transparent");
    radGrad.appendChild(stop0);
    radGrad.appendChild(stop1);
    defs.appendChild(radGrad);
    svg.appendChild(defs);
    var glowCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    glowCircle.setAttribute("cx", "-9999");
    glowCircle.setAttribute("cy", "-9999");
    glowCircle.setAttribute("r", "160");
    glowCircle.setAttribute("fill", "url(#" + glowId + ")");
    glowCircle.style.opacity = "0";
    glowCircle.style.willChange = "opacity";
    svg.appendChild(glowCircle);

    inner.appendChild(canvas);
    inner.appendChild(svg);
    root.appendChild(inner);
    document.body.insertBefore(root, document.body.firstChild);

    var ctx = canvas.getContext("2d", { alpha: true });
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    var props = {
      dotRadius: 1.5,
      dotSpacing: 16,
      cursorRadius: 500,
      cursorForce: 0.1,
      bulgeOnly: true,
      bulgeStrength: 67,
      sparkle: false,
      waveAmplitude: 0,
      gradientFrom: "rgba(79, 156, 255, 0.38)",
      gradientTo: "rgba(34, 211, 238, 0.22)"
    };

    var dots = [];
    var mouse = { x: -9999, y: -9999, prevX: -9999, prevY: -9999, speed: 0 };
    var size = { w: 0, h: 0, rectLeft: 0, rectTop: 0 };
    var glowOpacity = { v: 0 };
    var engagement = { v: 0 };
    var rafId = null;
    var resizeTimer = null;
    var frameCount = 0;

    function buildDots(w, h) {
      var p = props;
      var step = p.dotRadius + p.dotSpacing;
      var cols = Math.floor(w / step);
      var rows = Math.floor(h / step);
      while (rows * cols > 10000) {
        step *= 1.06;
        cols = Math.floor(w / step);
        rows = Math.floor(h / step);
      }
      var padX = (w % step) / 2;
      var padY = (h % step) / 2;
      dots = [];
      for (var row = 0; row < rows; row++) {
        for (var col = 0; col < cols; col++) {
          var ax = padX + col * step + step / 2;
          var ay = padY + row * step + step / 2;
          dots.push({ ax: ax, ay: ay, sx: ax, sy: ay, vx: 0, vy: 0, x: ax, y: ay });
        }
      }
    }

    function doResize() {
      var rect = inner.getBoundingClientRect();
      var w = rect.width;
      var h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      size.w = w;
      size.h = h;
      size.rectLeft = rect.left;
      size.rectTop = rect.top;
      buildDots(w, h);
    }

    function resize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(doResize, 100);
    }

    function onMouseMove(e) {
      mouse.x = e.clientX - size.rectLeft;
      mouse.y = e.clientY - size.rectTop;
    }

    function updateMouseSpeed() {
      var dx = mouse.prevX - mouse.x;
      var dy = mouse.prevY - mouse.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      mouse.speed += (dist - mouse.speed) * 0.5;
      if (mouse.speed < 0.001) mouse.speed = 0;
      mouse.prevX = mouse.x;
      mouse.prevY = mouse.y;
    }

    function tick() {
      frameCount++;
      var w = size.w;
      var h = size.h;
      var p = props;
      var len = dots.length;
      var t = frameCount * 0.02;
      var m = mouse;

      var targetEngagement = Math.min(m.speed / 5, 1);
      engagement.v += (targetEngagement - engagement.v) * 0.06;
      if (engagement.v < 0.001) engagement.v = 0;
      var eng = engagement.v;

      glowOpacity.v += (eng - glowOpacity.v) * 0.08;
      glowCircle.setAttribute("cx", String(m.x));
      glowCircle.setAttribute("cy", String(m.y));
      glowCircle.style.opacity = String(glowOpacity.v);

      ctx.clearRect(0, 0, w, h);
      var grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, p.gradientFrom);
      grad.addColorStop(1, p.gradientTo);
      ctx.fillStyle = grad;

      var cr = p.cursorRadius;
      var crSq = cr * cr;
      var rad = p.dotRadius / 2;
      var isBulge = p.bulgeOnly;

      ctx.beginPath();
      for (var i = 0; i < len; i++) {
        var d = dots[i];
        var dx = m.x - d.ax;
        var dy = m.y - d.ay;
        var distSq = dx * dx + dy * dy;

        if (distSq < crSq && eng > 0.01) {
          var dist = Math.sqrt(distSq);
          if (isBulge) {
            var f = 1 - dist / cr;
            var push = f * f * p.bulgeStrength * eng;
            var angle = Math.atan2(dy, dx);
            d.sx += (d.ax - Math.cos(angle) * push - d.sx) * 0.15;
            d.sy += (d.ay - Math.sin(angle) * push - d.sy) * 0.15;
          } else {
            var angle2 = Math.atan2(dy, dx);
            var move = (500 / dist) * (m.speed * p.cursorForce);
            d.vx += Math.cos(angle2) * -move;
            d.vy += Math.sin(angle2) * -move;
          }
        } else if (isBulge) {
          d.sx += (d.ax - d.sx) * 0.1;
          d.sy += (d.ay - d.sy) * 0.1;
        }

        if (!isBulge) {
          d.vx *= 0.9;
          d.vy *= 0.9;
          d.x = d.ax + d.vx;
          d.y = d.ay + d.vy;
          d.sx += (d.x - d.sx) * 0.1;
          d.sy += (d.y - d.sy) * 0.1;
        }

        var drawX = d.sx;
        var drawY = d.sy;
        if (p.waveAmplitude > 0) {
          drawY += Math.sin(d.ax * 0.03 + t) * p.waveAmplitude;
          drawX += Math.cos(d.ay * 0.03 + t * 0.7) * p.waveAmplitude * 0.5;
        }

        if (p.sparkle) {
          var hash = ((i * 2654435761) ^ (frameCount >> 3)) >>> 0;
          if (hash % 100 < 3) {
            ctx.moveTo(drawX + rad * 1.8, drawY);
            ctx.arc(drawX, drawY, rad * 1.8, 0, TWO_PI);
          } else {
            ctx.moveTo(drawX + rad, drawY);
            ctx.arc(drawX, drawY, rad, 0, TWO_PI);
          }
        } else {
          ctx.moveTo(drawX + rad, drawY);
          ctx.arc(drawX, drawY, rad, 0, TWO_PI);
        }
      }
      ctx.fill();
      rafId = requestAnimationFrame(tick);
    }

    function oneStaticFrame() {
      frameCount++;
      var w = size.w;
      var h = size.h;
      var p = props;
      var len = dots.length;
      ctx.clearRect(0, 0, w, h);
      var grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, p.gradientFrom);
      grad.addColorStop(1, p.gradientTo);
      ctx.fillStyle = grad;
      var rad = p.dotRadius / 2;
      ctx.beginPath();
      for (var i = 0; i < len; i++) {
        var d = dots[i];
        ctx.moveTo(d.ax + rad, d.ay);
        ctx.arc(d.ax, d.ay, rad, 0, TWO_PI);
      }
      ctx.fill();
    }

    function refreshRectOrigin() {
      var rect = inner.getBoundingClientRect();
      size.rectLeft = rect.left;
      size.rectTop = rect.top;
    }

    doResize();

    if (reduced) {
      oneStaticFrame();
      window.addEventListener(
        "resize",
        function () {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(function () {
            doResize();
            oneStaticFrame();
          }, 100);
        },
        { passive: true }
      );
      return;
    }

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("scroll", refreshRectOrigin, { passive: true });
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    var speedInterval = setInterval(updateMouseSpeed, 20);
    rafId = requestAnimationFrame(tick);

    window.addEventListener(
      "beforeunload",
      function () {
        cancelAnimationFrame(rafId);
        clearInterval(speedInterval);
        clearTimeout(resizeTimer);
        window.removeEventListener("resize", resize);
        window.removeEventListener("scroll", refreshRectOrigin);
        window.removeEventListener("mousemove", onMouseMove);
      },
      { once: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
