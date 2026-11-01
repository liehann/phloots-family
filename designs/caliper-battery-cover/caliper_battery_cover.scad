// Replacement slide-on battery cover for a generic 6" digital caliper
// (Neiko 01407A style, same housing as the Harbor Freight "Pittsburgh" and
// most other LR44 / SR44 import calipers).
//
// Frame of reference:
//   X  = sliding direction. +X is the OPEN end of the channel (toward the beam),
//        which is the end you push on to remove the cover.
//   Y  = across the channel.
//   Z  = outward from the caliper. Z = 0 is the underside facing the battery.
//
// All dimensions are mm. Measure your caliper and set the five values marked
// MEASURE below (see README.md for a picture of each one), then render with
// part = "cover". Print part = "fit_test" first if you are unsure of the width.

part = "cover";            // "cover" or "fit_test"

// ---------- MEASURE these on the caliper ----------
channel_w   = 15.0;        // A: width of the channel, groove bottom to groove bottom
opening_w   = 12.6;        // B: visible opening between the two lips
cover_l     = 18.0;        // D: closed end of the channel to the edge of the housing
plate_t     = 1.5;         // E: housing surface down to the bottom of the groove
tongue_t    = 0.8;         // C: height of the groove (the slot the tongue rides in)

// ---------- fit / tolerance ----------
clearance   = 0.15;        // removed from the width and from the tongue height
lead_chamfer = 0.4;        // chamfer on the leading (inner) edge of the tongues

// ---------- optional features ----------
grip_ribs   = 3;           // raised ribs for your thumb near the open end (0 = none)
rib_w       = 0.6;
rib_h       = 0.35;
rib_pitch   = 1.6;
rib_inset   = 2.0;         // distance of first rib from the open end

detent_d    = 0;           // diameter of a round bump on the underside (0 = none).
detent_h    = 0.3;         // how far it protrudes
detent_x    = 4.0;         // distance from the open end

battery_pad_h = 0;         // pad on the underside that presses the cell down (0 = none)
battery_pad_d = 8.0;
battery_x     = 8.0;       // pad centre, measured from the closed (inner) end

end_lip_h   = 0;           // downward lip at the open end that closes the housing opening (0 = none)
end_lip_t   = 1.0;

$fn = 48;

// ---------------------------------------------------------------------------

lip_w = (channel_w - opening_w) / 2;        // how far each housing lip overhangs

module cover_body(w = channel_w, len = cover_l) {
    ww = w - clearance;                     // full width including tongues
    vw = opening_w - clearance;             // visible width between the lips
    tt = tongue_t - clearance;              // tongue thickness
    difference() {
        union() {
            // upper plate, sits between the lips
            translate([0, -vw / 2, 0]) cube([len, vw, plate_t]);
            // tongue layer, full width, rides in the grooves
            translate([0, -ww / 2, 0]) cube([len, ww, tt]);
        }
        // chamfer the leading edge of the tongues (inner end, x = 0) for easy insertion
        // triangle whose hypotenuse is the line x + z = lead_chamfer
        rotate([90, 0, 0])
            linear_extrude(height = ww + 2, center = true)
                polygon([[-1, -1], [lead_chamfer + 1, -1], [-1, lead_chamfer + 1]]);
    }
}

module grip() {
    vw = opening_w - clearance;
    for (i = [0 : grip_ribs - 1])
        translate([cover_l - rib_inset - i * rib_pitch - rib_w, -vw / 2 + 0.6, plate_t - 0.01])
            cube([rib_w, vw - 1.2, rib_h + 0.01]);
}

module detent() {
    if (detent_d > 0) {
        cx = cover_l - detent_x;
        intersection() {
            translate([cx, 0, detent_d / 2 - detent_h]) sphere(d = detent_d);
            // keep only the part below the underside plus a little inside the tongue layer
            translate([cx - detent_d, -detent_d, -detent_h])
                cube([2 * detent_d, 2 * detent_d, detent_h + tongue_t - clearance]);
        }
    }
}

module battery_pad() {
    if (battery_pad_h > 0)
        translate([battery_x, 0, -battery_pad_h])
            cylinder(d = battery_pad_d, h = battery_pad_h + 0.01);
}

module end_lip() {
    if (end_lip_h > 0)
        translate([cover_l - end_lip_t, -(opening_w - clearance) / 2, -end_lip_h])
            cube([end_lip_t, opening_w - clearance, end_lip_h + 0.01]);
}

module cover() {
    union() {
        cover_body();
        if (grip_ribs > 0) grip();
        detent();
        battery_pad();
        end_lip();
    }
}

// Three short coupons, 0.5 mm narrower / nominal / 0.5 mm wider, marked with
// 1, 2 and 3 notches. Slide each into the channel; the one that is snug but
// moves without force gives you channel_w.
module fit_test() {
    len = 6;
    for (i = [0 : 2]) {
        w = channel_w + (i - 1) * 0.5;
        translate([0, i * (channel_w + 4), 0])
            difference() {
                cover_body(w = w, len = len);
                for (n = [0 : i])
                    translate([len - 1.5 - n * 1.5, -opening_w / 2 - 1, plate_t - 0.3])
                        cube([0.6, opening_w + 2, 1]);
            }
    }
}

if (part == "cover") cover();
else if (part == "fit_test") fit_test();
