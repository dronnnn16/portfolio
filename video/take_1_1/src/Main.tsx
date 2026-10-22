import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate } from "remotion";
import { ARoll, At, Card, Cutout, Framing, Hero, Heavy, Letterbox, On, PUNCH, Settle, Shot, Slam, Small, WIDE } from "./kit";
import { C, LOGIC } from "./theme";
import { END, F, TOTAL } from "./sync";

// Small build-up words sit beside the face, on the dark monitor (x 0-520 in the wide frame).
const SIDE = { x: 470, y: 560 };
// Fake second camera for the TURN: tight, subject pushed to the right third.
const TURN: Framing = { s: 1.35, cx: 1000, cy: 440, tx: 1280, ty: 440 };
// Punch-in toward the award in the hand.
const AWARD_PUNCH: Framing = { s: 1.15, cx: 835, cy: 560, tx: 960, ty: 560 };

const Reel: React.FC<{ from: number; slide?: boolean; bg: string; children: React.ReactNode }> = ({
  from,
  slide,
  bg,
  children,
}) => {
  const f = useCurrentFrame();
  const y = slide ? interpolate(f, [from, from + 10], [140, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: 1180 - 270,
        top: 60 + y,
        width: 540,
        height: 960,
        borderRadius: 40,
        overflow: "hidden",
        background: bg,
        boxShadow: "0 40px 80px rgba(10,30,80,0.28), 0 8px 24px rgba(10,30,80,0.18)",
      }}
    >
      {children}
    </div>
  );
};

export const Main: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* ───────── HOOK: "2026 ke 7 mahine kahan chale gaye, tumhe bhi nahi pata." ───────── */}
      <On from={0} to={F("kahan1")}>
        <ARoll framing={WIDE} />
        <At {...SIDE} align="right">
          <Small at={F("y2026")}>2026</Small>
          <Small at={F("ke")}>ke</Small>
        </At>
        <At x={960} y={650}>
          <Hero at={F("saat")} until={F("kahan1")} size={300} shadow>
            7
          </Hero>
          <Hero at={F("mahine1")} until={F("kahan1")} size={300} shadow>
            mahine
          </Hero>
        </At>
        <Letterbox />
      </On>
      <On from={F("kahan1")} to={F("chale")}>
        <Card kind="white" />
        <At x={960} y={540}>
          <Heavy at={F("kahan1")} until={F("chale")} size={380} fill>
            KAHAN
          </Heavy>
        </At>
      </On>
      <On from={F("chale")} to={F("tumhe")}>
        <Card kind="white" />
        <At x={960} y={540}>
          <Heavy at={F("chale")} until={F("tumhe")} size={300} fill>
            CHALE
          </Heavy>
          <Heavy at={F("gaye")} until={F("tumhe")} size={300} fill>
            GAYE
          </Heavy>
        </At>
      </On>
      <On from={F("tumhe")} to={F("bhi1")}>
        <ARoll framing={PUNCH} />
        <At {...SIDE} align="right">
          <Small at={F("tumhe")}>tumhe</Small>
        </At>
      </On>
      <On from={F("bhi1")} to={F("paanch")}>
        <Card kind="blue" />
        <At x={960} y={540}>
          <Slam at={F("nahi1")} until={F("paanch")} size={380}>
            NAHI
          </Slam>
          <Slam at={F("pata")} until={F("paanch")} size={380}>
            PATA.
          </Slam>
        </At>
      </On>

      {/* ───────── WORD CARDS: "5 mahine bache hain … khud ko prove …" ───────── */}
      <On from={F("paanch")} to={F("khud")}>
        <Card kind="leak" />
        <At x={960} y={470}>
          <Hero at={F("paanch")} until={F("khud")} size={330} color={C.blue}>
            5
          </Hero>
          <Hero at={F("mahine2")} until={F("khud")} size={330} color={C.blue}>
            mahine
          </Hero>
        </At>
        <At x={960} y={800}>
          <Small at={F("bache")} color={C.blue} size={52}>
            bache
          </Small>
          <Small at={F("hain1")} color={C.blue} size={52}>
            hain
          </Small>
        </At>
      </On>
      <On from={F("khud")} to={F("achha")}>
        <ARoll framing={WIDE} />
        <At {...SIDE} align="right">
          <Small at={F("khud")}>khud</Small>
          <Small at={F("ko")}>ko</Small>
        </At>
        <At x={960} y={650}>
          <Hero at={F("prove")} until={F("achha")} size={340} shadow>
            prove
          </Hero>
        </At>
      </On>

      {/* ───────── PATTERN: reels → gaadi → gaddiyan → NAHI BATA RAHA → shuru ───────── */}
      <On from={F("achha")} to={F("ye1")}>
        <ARoll framing={PUNCH} />
        <At {...SIDE} align="right">
          <Small at={F("tumhari")}>tumhari</Small>
          <Small at={F("feed")}>feed</Small>
          <Small at={F("mein")}>mein</Small>
        </At>
        <At x={960} y={650}>
          <Hero at={F("reels")} until={F("ye1")} size={340} shadow>
            reels
          </Hero>
        </At>
      </On>
      <On from={F("ye1")} to={F("ye2")}>
        <Card kind="white" />
        <At x={600} y={540}>
          <Small at={F("ye1")} color={C.blue} size={64}>
            ye
          </Small>
          <Small at={F("banda")} color={C.blue} size={64}>
            banda
          </Small>
        </At>
        <Reel from={F("ye1")} slide bg={`linear-gradient(160deg, ${C.royalB} 0%, ${C.royalA} 100%)`}>
          <At x={270} y={300}>
            <Small at={F("trading1")}>trading</Small>
            <Small at={F("se1")}>se</Small>
          </At>
          <At x={270} y={500}>
            <Hero at={F("gaadi")} until={F("ye2")} size={210}>
              gaadi
            </Hero>
          </At>
        </Reel>
      </On>
      <On from={F("ye2")} to={F("lekin")}>
        <Card kind="white" />
        <At x={600} y={540}>
          <Small at={F("ye2")} color={C.blue} size={64}>
            ye
          </Small>
        </At>
        <Reel from={F("ye2")} bg="linear-gradient(160deg, #0B1E4A 0%, #030A1C 100%)">
          <At x={270} y={470}>
            <Hero at={F("gaddiyan")} until={F("lekin")} size={128}>
              gaddiyan
            </Hero>
          </At>
          <At x={270} y={680}>
            <Small at={F("gin")}>gin</Small>
            <Small at={F("raha1")}>raha</Small>
            <Small at={F("hai")}>hai</Small>
          </At>
        </Reel>
      </On>
      <On from={F("lekin")} to={F("aake")}>
        <ARoll framing={WIDE} />
        <At {...SIDE} align="right">
          <Small at={F("koi")}>koi</Small>
          <Small at={F("bhi2")}>bhi</Small>
        </At>
      </On>
      <On from={F("aake")} to={F("kahan2")}>
        <Card kind="blue" />
        <At x={960} y={540}>
          <Slam at={F("nahi2")} until={F("kahan2")} size={300}>
            NAHI
          </Slam>
          <Slam at={F("bata")} until={F("kahan2")} size={300}>
            BATA
          </Slam>
          <Slam at={F("raha2")} until={F("kahan2")} size={300}>
            RAHA
          </Slam>
        </At>
      </On>
      <On from={F("kahan2")} to={F("ye3")}>
        <Card kind="leak" />
        <At x={960} y={330}>
          <Small at={F("kahan2")} color={C.blue} size={64}>
            kahan
          </Small>
          <Small at={F("se2")} color={C.blue} size={64}>
            se
          </Small>
        </At>
        <At x={960} y={590}>
          <Hero at={F("shuru")} until={F("ye3")} size={270} color={C.blue}>
            shuru
          </Hero>
          <Hero at={F("karein")} until={F("ye3")} size={270} color={C.blue}>
            karein?
          </Hero>
        </At>
      </On>

      {/* ───────── CREDENTIALS ───────── */}
      <On from={F("ye3")} to={F("mera")}>
        <ARoll framing={f < F("door") ? PUNCH : WIDE} />
        <At {...SIDE} align="right">
          <Small at={F("ye3")}>ye</Small>
          <Small at={F("shanka")}>shanka</Small>
        </At>
        <At x={960} y={650}>
          <Hero at={F("door")} until={F("mera")} size={340} shadow>
            door
          </Hero>
        </At>
      </On>
      <On from={F("mera")} to={F("aath")}>
        <Card kind="white" />
        <At x={960} y={360}>
          <Small at={F("mera")} color={C.blue} size={64}>
            mera
          </Small>
          <Small at={F("naam")} color={C.blue} size={64}>
            naam
          </Small>
        </At>
        <At x={960} y={610}>
          <Hero at={F("abhishek")} until={F("aath")} size={300} color={C.blue}>
            Abhishek
          </Hero>
        </At>
      </On>
      <On from={F("aath")} to={F("professionally")}>
        <Card kind="blue" />
        <At x={960} y={540}>
          <Heavy at={F("aath")} until={F("professionally")} size={420}>
            8
          </Heavy>
          <Heavy at={F("saalon")} until={F("professionally")} size={420}>
            SAAL
          </Heavy>
        </At>
      </On>
      <On from={F("professionally")} to={F("ye4")}>
        <ARoll framing={WIDE} />
        <At {...SIDE} align="right">
          <Small at={F("professionally")}>professionally</Small>
        </At>
        <At x={960} y={650}>
          <Hero at={F("trade")} until={F("ye4")} size={340} shadow>
            trade
          </Hero>
        </At>
      </On>

      {/* ───────── AWARD (premium) ───────── */}
      <On from={F("ye4")} to={F("jab")}>
        <Card kind="black" />
        <At x={960} y={420}>
          <Settle from={F("ye4")} to={F("jab")}>
            <Img src={staticFile("assets/award.png")} style={{ height: 700, filter: "drop-shadow(0 0 60px rgba(255,200,90,0.18))" }} />
          </Settle>
        </At>
        <At x={960} y={890}>
          <Hero at={F("iit")} until={F("jab")} size={200}>
            IIT
          </Hero>
          <Hero at={F("guwahati")} until={F("jab")} size={200}>
            Guwahati
          </Hero>
        </At>
      </On>
      <On from={F("jab")} to={F("trading2")}>
        <ARoll framing={AWARD_PUNCH} />
      </On>
      <On from={F("trading2")} to={F("ab")}>
        <Card kind="black" />
        <At x={520} y={540}>
          <Settle from={F("trading2")} to={F("ab")} s0={1.04} s1={0.98}>
            <Img src={staticFile("assets/award.png")} style={{ height: 600, filter: "drop-shadow(0 0 50px rgba(255,200,90,0.15))" }} />
          </Settle>
        </At>
        <At x={1260} y={420}>
          <Small at={F("trading2")} size={64}>
            trading
          </Small>
        </At>
        <At x={1260} y={600}>
          <Hero at={F("sessions")} until={F("ab")} size={230}>
            sessions
          </Hero>
        </At>
      </On>

      {/* ───────── TURN: "Ab main yahan par kyun aaya hoon?" (text behind subject) ───────── */}
      <On from={F("ab")} to={F("kyunki")}>
        <ARoll framing={TURN} grade="moody" push={[F("ab"), F("kyunki"), 1, 1.02]} />
        <At x={720} y={500}>
          <TurnWord at={F("kyun")} />
        </At>
        <Cutout framing={TURN} grade="moody" push={[F("ab"), F("kyunki"), 1, 1.02]} />
      </On>

      {/* ───────── MONTAGE → PAYOFF ───────── */}
      <On from={F("kyunki")} to={F("humein2")}>
        <Shot from={F("kyunki")} to={F("bahut")} src={255} x={640} y={120} w={676} />
        <Shot from={F("bahut")} to={F("comments")} src={90} x={0} y={300} w={600} />
        <Shot from={F("comments")} to={F("hain2")} src={390} x={800} y={680} w={711} />
        <Shot from={F("hain2")} to={F("bhaiya")} src={570} x={790} y={140} w={551} />
        <Shot from={F("bhaiya")} to={F("sikhao1")} src={500} x={680} y={700} w={676} />
        <Shot from={F("sikhao1")} to={F("humein2")} src={800} x={700} y={230} w={600} />
        <At x={960} y={f < F("sikhao1") ? 520 : 330}>
          <div>
            <Small at={F("bahut")}>bahut</Small>
            <Small at={F("saare")}>saare</Small>
            <Small at={F("comments")}>comments</Small>
            <Small at={F("aate")}>aate</Small>
            <Small at={F("hain2")}>hain</Small>
          </div>
          <div style={{ marginTop: 14 }}>
            <Small at={F("bhaiya")}>bhaiya,</Small>
            <Small at={F("humein1")}>humein</Small>
            <Small at={F("bhi3")}>bhi</Small>
          </div>
        </At>
        <At x={960} y={640}>
          <Hero at={F("sikhao1")} until={F("humein2")} size={360} shadow>
            Sikhao.
          </Hero>
        </At>
      </On>
      <On from={F("humein2")} to={F("bhi4")}>
        <Card kind="leak" />
        <At x={960} y={540}>
          <Hero at={F("humein2")} until={F("bhi4")} size={380} fill>
            humein
          </Hero>
        </At>
      </On>
      <On from={F("bhi4")} to={END}>
        <ARoll framing={WIDE} />
        <At {...SIDE} align="right">
          <Small at={F("bhi4") - 1}>humein</Small>
          <Small at={F("bhi4")}>bhi</Small>
        </At>
        <At x={960} y={660}>
          <Heavy at={F("sikhao2")} until={END} size={300}>
            sikhao
          </Heavy>
        </At>
        <Letterbox />
      </On>

      {/* ───────── HARD CUT TO BLACK ───────── */}
      <On from={END} to={TOTAL}>
        <Card kind="black" />
      </On>
    </AbsoluteFill>
  );
};

/** Big grey logic-voice word that sits behind the subject. */
const TurnWord: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [at - 1, at + 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const s = interpolate(f, [at - 1, at + 30], [1.06, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: LOGIC,
        fontWeight: 900,
        fontSize: 380,
        letterSpacing: -16,
        color: C.grey,
        opacity: o * 0.92,
        transform: `scale(${s})`,
      }}
    >
      kyun?
    </span>
  );
};
