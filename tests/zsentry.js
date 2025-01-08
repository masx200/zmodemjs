#!/usr/bin/env node

"use strict";

var tape = require("blue-tape");

var helper = require("./lib/testhelp");

global.Zmodem = require("./lib/zmodem");

var ZSentry = Zmodem.Sentry;

function _generate_tester() {
    var tester = {
        reset() {
            this.to_terminal = [];
            this.to_server = [];
            this.retracted = 0;
        },
    };

    tester.sentry = new ZSentry({
        to_terminal(octets) {
            tester.to_terminal.push.apply(tester.to_terminal, octets);
        },
        on_detect(z) {
            tester.detected = z;
        },
        on_retract(z) {
            tester.retracted++;
        },
        sender(octets) {
            tester.to_server.push.apply(tester.to_server, octets);
        },
    });

    tester.reset();

    return tester;
}

tape("user says deny() to detection", (t) => {
    var tester = _generate_tester();

    var makes_offer = helper.string_to_octets(
        "hey**\x18B00000000000000\x0d\x0a\x11",
    );
    tester.sentry.consume(makes_offer);

    t.is(typeof tester.detected, "object", "There is a session after ZRQINIT");

    var sent_before = tester.to_server.length;

    tester.detected.deny();

    t.deepEqual(
        tester.to_server.slice(-Zmodem.ZMLIB.ABORT_SEQUENCE.length),
        Zmodem.ZMLIB.ABORT_SEQUENCE,
        "deny() sends abort sequence to server",
    );

    t.end();
});

tape("retraction because of non-ZMODEM", (t) => {
    var tester = _generate_tester();

    var makes_offer = helper.string_to_octets(
        "hey**\x18B00000000000000\x0d\x0a\x11",
    );
    tester.sentry.consume(makes_offer);

    t.is(typeof tester.detected, "object", "There is a session after ZRQINIT");

    tester.sentry.consume([0x20, 0x21, 0x22]);

    t.is(tester.retracted, 1, "retraction since we got non-ZMODEM input");

    t.end();
});

tape("retraction because of YMODEM downgrade", (t) => {
    var tester = _generate_tester();

    var makes_offer = helper.string_to_octets(
        "**\x18B00000000000000\x0d\x0a\x11",
    );
    tester.sentry.consume(makes_offer);

    t.deepEquals(tester.to_server, [], "nothing sent to server before");

    tester.sentry.consume(helper.string_to_octets("C"));

    t.deepEquals(
        tester.to_server,
        Zmodem.ZMLIB.ABORT_SEQUENCE,
        "abort sent to server",
    );

    t.end();
});

tape("replacement ZMODEM is not of same type", (t) => {
    var tester = _generate_tester();

    var zrqinit = helper.string_to_octets("**\x18B00000000000000\x0d\x0a\x11");
    tester.sentry.consume(zrqinit);

    var before = tester.to_terminal.length;

    var zrinit = helper.string_to_octets("**\x18B0100000000aa51\x0d\x0a\x11");
    tester.sentry.consume(zrinit);

    t.notEqual(
        tester.to_terminal.length,
        before,
        "output to terminal when replacement session is of different type",
    );

    t.end();
});

tape("retraction because of duplicate ZMODEM, and confirm()", (t) => {
    var tester = _generate_tester();

    var makes_offer = helper.string_to_octets(
        "**\x18B00000000000000\x0d\x0a\x11",
    );
    tester.sentry.consume(makes_offer);

    t.is(
        typeof tester.detected,
        "object",
        "There is a detection after ZRQINIT",
    );

    var first_detected = tester.detected;
    t.is(first_detected.is_valid(), true, "detection is valid");

    tester.reset();

    tester.sentry.consume(makes_offer);

    t.is(tester.retracted, 1, "retraction since we got non-ZMODEM input");
    t.deepEquals(
        tester.to_terminal,
        [],
        "nothing sent to terminal on dupe session",
    );

    t.notEqual(
        tester.detected,
        first_detected,
        "… but a new detection happened in its place",
    );

    t.is(first_detected.is_valid(), false, "old detection is invalid");
    t.is(tester.detected.is_valid(), true, "new detection is valid");

    //----------------------------------------------------------------------

    var session = tester.detected.confirm();

    t.is(session instanceof Zmodem.Session, true, "confirm() on the detection");
    t.is(session.type, "receive", "session is of the right type");

    tester.reset();

    //Verify that the Detection configures the Session correctly.
    session.start();
    t.is(!!tester.to_server.length, true, "sent output after start()");

    t.end();
});

tape("parse passthrough", (t) => {
    var tester = _generate_tester();

    var strings = new Map([
        ["plain", "heyhey"],
        ["one_asterisk", "hey*hey"],
        ["two_asterisks", "hey**hey"],
        ["wrong_header", "hey**\x18B09010203040506\x0d\x0a"],
        ["ZRQINIT but not at end", "hey**\x18B00000000000000\x0d\x0ahahahaha"],
        ["ZRINIT but not at end", "hey**\x18B01010203040506\x0d\x0ahahahaha"],

        //Use \x2a here to avoid tripping up ZMODEM-detection in
        //text editors when working on this code.
        ["no_ZDLE", "hey\x2a*B00000000000000\x0d\x0a"],
    ]);

    for (let [name, string] of strings) {
        tester.reset();

        var octets = helper.string_to_octets(string);

        var before = octets.slice(0);

        tester.sentry.consume(octets);

        t.deepEquals(
            tester.to_terminal,
            before,
            `regular text goes through: ${name}`,
        );

        t.is(tester.detected, undefined, "... and there is no session");
        t.deepEquals(octets, before, "... and the array is unchanged");
    }

    t.end();
});

tape("parse", (t) => {
    var hdrs = new Map([
        ["receive", Zmodem.Header.build("ZRQINIT")],
        [
            "send",
            Zmodem.Header.build("ZRINIT", ["CANFDX", "CANOVIO", "ESCCTL"]),
        ],
    ]);

    for (let [sesstype, hdr] of hdrs) {
        var full_input = helper.string_to_octets("before").concat(
            hdr.to_hex(),
        );

        for (var start = 1; start < full_input.length - 1; start++) {
            let octets1 = full_input.slice(0, start);
            let octets2 = full_input.slice(start);

            var tester = _generate_tester();
            tester.sentry.consume(octets1);

            t.deepEquals(
                tester.to_terminal,
                octets1,
                `${sesstype}: Parse first ${start} byte(s) of text (${full_input.length} total)`,
            );
            t.is(tester.detected, undefined, "... and there is no session");

            tester.reset();

            tester.sentry.consume(octets2);
            t.deepEquals(
                tester.to_terminal,
                octets2,
                `Rest of text goes through`,
            );
            t.is(
                typeof tester.detected,
                "object",
                "... and now there is a session",
            );
            t.is(
                tester.detected.get_session_role(),
                sesstype,
                "... of the right type",
            );
        }
    }

    t.end();
});
