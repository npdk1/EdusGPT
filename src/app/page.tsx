import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Cpu,
  Gauge,
  KeyRound,
  MousePointerClick,
  CirclePlay,
  Repeat,
  ScanEye,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { HeroCanvas } from "@/components/three/HeroCanvas";
import { Magnetic, Marquee } from "@/components/motion/Interactive";
import { Reveal } from "@/components/motion/Reveal";
import { AnimatedNumber, SplitHeading } from "@/components/motion/SplitHeading";
import { SetupCallout } from "@/components/site/AiKeyBadge";

const FEATURES = [
  {
    icon: Repeat,
    title: "Tua hai chiều, không trôi hình",
    body: "Mỗi cảnh có mốc thời gian riêng nên tua tới hay tua lui đều ra đúng khung, kể cả khi tua ngược lại giữa chừng.",
    tone: "brand" as const,
  },
  {
    icon: Boxes,
    title: "Ba lớp chuyển động",
    body: "Nền 3D, chuyển động giao diện và nội dung bài giảng là ba lớp riêng. Mỗi lớp tách bạch, tắt được khi máy yếu.",
    tone: "gold" as const,
  },
  {
    icon: KeyRound,
    title: "Cài API key ngay trên web",
    body: "Mở /setup trên localhost, dán key, bấm kiểm tra là xong. Key nằm trong .env trên máy bạn, không đi đâu khác.",
    tone: "ember" as const,
  },
];

const STACK = [
  {
    icon: Gauge,
    title: "Không gradient tím",
    body: "Toàn bộ hệ màu là teal, gold và ink. Có script check:palette chặn ngay nếu source lỡ xuất hiện màu tím hay xanh tím, dù là class hay mã hex.",
    tint: "from-brand-500/15",
  },
  {
    icon: ScanEye,
    title: "Biết mình đang ở đâu",
    body: "Rê chuột lên timeline là biết mốc thời gian ngay tại chỗ. Chương đã đọc thì mờ đi, chương đang học thì sáng lên.",
    tint: "from-gold-500/15",
  },
  {
    icon: Cpu,
    title: "Mọi thứ chạy ngay trên máy bạn",
    body: "Server route giữ cho API key không lộ ra trình duyệt, còn bài giảng, timeline và phần mốc thời gian thì chạy ngay trên máy bạn.",
    tint: "from-ember-500/15",
  },
];

const TOPICS = [
  "Định luật II Newton",
  "Overfitting",
  "Đạo hàm theo định nghĩa",
  "Vòng lặp for",
  "Thì hiện tại hoàn thành",
  "Cân bằng phản ứng hoá học",
  "Hàm số bậc hai",
  "Quang hợp ở thực vật",
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* hero */}
      <section className="relative -mx-4 overflow-hidden px-4 pt-14 sm:-mx-6 sm:px-6 lg:pt-20">
        <HeroCanvas className="pointer-events-none absolute inset-0 opacity-90" />
        <div className="relative grid gap-10 pb-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
          <div>
            <span className="chip">
              <Sparkles className="h-3.5 w-3.5 text-gold-300" />
              Chạy trên máy bạn
            </span>
            <SplitHeading
              as="h1"
              immediate
              className="mt-5 text-balance text-4xl font-bold tracking-tight text-mist-50 sm:text-5xl lg:text-6xl"
            >
              <span className="text-gradient-warm">Bài giảng AI tua được từng giây</span>
            </SplitHeading>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-mist-300 sm:text-lg">
              Bài giảng thành timeline có thể tua tới, tua lui, lặp một đoạn
              để học kỹ, kèm giọng đọc và phụ đề chạy theo từng chữ. Mọi thứ
              chạy trên máy bạn, không cần tài khoản hay database.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Magnetic>
                <Link href="/lesson" className="btn-primary px-5 py-3">
                  <CirclePlay className="h-4 w-4" /> Mở trình phát &amp; thử tua
                </Link>
              </Magnetic>
              <Link href="/setup" className="btn-ghost px-5 py-3">
                <KeyRound className="h-4 w-4" /> Cài API key
              </Link>
              <Link
                href="/studio"
                className="inline-flex items-center gap-2 px-2 py-3 text-sm font-semibold text-brand-200 transition-colors hover:text-brand-100"
              >
                <WandSparkles className="h-4 w-4" /> Sinh bài giảng mới
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <dl className="mt-10 grid max-w-xl grid-cols-3 gap-4">
              {[
                { value: 25, suffix: " khung", label: "mỗi giây tua mượt" },
                { value: 36, suffix: "s", label: "bài mẫu sẵn sàng" },
                { value: 0, suffix: " byte", label: "dữ liệu rời khỏi máy" },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-xl font-bold text-brand-200 sm:text-2xl">
                    <AnimatedNumber value={item.value} suffix={item.suffix} />
                  </dt>
                  <dd className="mt-1 text-xs text-mist-400">{item.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <Reveal className="panel relative p-5 lg:p-6" y={40}>
            <div className="flex items-center justify-between gap-3">
              <span className="chip">
                <MousePointerClick className="h-3.5 w-3.5" /> kéo để tua
              </span>
              <span className="font-mono text-[11px] text-mist-500">
                ◀◀ tua lui · ▶▶ tua tới
              </span>
            </div>

            <div className="mt-4 space-y-3 rounded-2xl border border-ink-700/70 bg-ink-950/70 p-4">
              <p className="font-mono text-[11px] uppercase tracking-widest text-mist-500">
                timeline
              </p>
              <div className="relative h-2.5 overflow-hidden rounded-full bg-ink-800">
                <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
              </div>
              <div className="flex justify-between font-mono text-[11px] text-mist-500">
                <span>00:22.4</span>
                <span>/ 00:36.0</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {["chương 1", "chương 2", "chương 3"].map((label, index) => (
                  <span
                    key={label}
                    className={`rounded-lg border px-2 py-1.5 text-center text-[11px] font-medium ${
                      index === 1
                        ? "border-brand-600 bg-brand-500/15 text-brand-100"
                        : "border-ink-700 text-mist-400"
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="kbd">Space</span>
                <span className="kbd">←</span>
                <span className="kbd">→</span>
                <span className="kbd">,</span>
                <span className="kbd">.</span>
                <span className="kbd">[ ]</span>
                <span className="ml-auto text-[11px] text-mist-500">
                  lặp đoạn khó bằng A→B
                </span>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-mist-400">
              Timeline sống ngay trong trình duyệt nên bạn tua tới lui thoải mái
              trước khi trình chiếu, xem lại ngay mà không cần render trước.
            </p>
          </Reveal>
        </div>
      </section>

      <div className="pb-4">
        <SetupCallout />
      </div>

      <section className="panel mt-4 overflow-hidden py-5">
        <Marquee duration={38}>
          {TOPICS.map((topic) => (
            <span key={topic} className="whitespace-nowrap text-sm font-medium text-mist-400">
              <span className="mr-10 text-brand-400">◆</span>
              {topic}
            </span>
          ))}
        </Marquee>
      </section>

      {/* features */}
      <section id="features" className="py-20">
        <Reveal>
          <span className="chip">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-300" /> khác biệt
          </span>
          <SplitHeading
            as="h2"
            className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-mist-50 sm:text-4xl"
          >
            Ba thứ bạn yêu cầu, làm tới nơi tới chốn
          </SplitHeading>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 0.08} className="panel p-6">
              <span
                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border ${
                  feature.tone === "brand"
                    ? "border-brand-700 bg-brand-500/10 text-brand-300"
                    : feature.tone === "gold"
                      ? "border-gold-600 bg-gold-500/10 text-gold-300"
                      : "border-ember-500/60 bg-ember-500/10 text-ember-400"
                }`}
              >
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-mist-50">
                {feature.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-mist-300">
                {feature.body}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* stack */}
      <section id="stack" className="pb-20">
        <Reveal>
          <span className="chip">
            <Boxes className="h-3.5 w-3.5 text-gold-300" /> kiến trúc
          </span>
          <SplitHeading
            as="h2"
            className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-mist-50 sm:text-4xl"
          >
            Đọc code là thấy hết luồng chạy
          </SplitHeading>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STACK.map((item, index) => (
            <Reveal
              key={item.title}
              delay={index * 0.08}
              className="panel-tight relative overflow-hidden p-6"
            >
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${item.tint} to-transparent`}
              />
              <item.icon className="relative h-5 w-5 text-mist-100" />
              <h3 className="relative mt-3.5 font-semibold text-mist-50">
                {item.title}
              </h3>
              <p className="relative mt-2 text-sm leading-relaxed text-mist-300">
                {item.body}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* cta */}
      <section className="pb-24">
        <Reveal className="panel relative overflow-hidden p-8 sm:p-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 animate-breathe bg-[radial-gradient(30rem_22rem_at_18%_20%,rgba(36,189,172,0.22),transparent_62%),radial-gradient(24rem_20rem_at_86%_78%,rgba(246,185,59,0.18),transparent_60%)]"
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-mist-50 sm:text-3xl">
                Bắt đầu trong hai bước
              </h2>
              <ol className="mt-4 space-y-2 text-sm text-mist-300">
                <li>
                  <span className="font-mono text-brand-200">1.</span> Mở{" "}
                  <Link href="/setup" className="text-gold-200 underline">
                    /setup
                  </Link>{" "}
                  và dán API key của bạn. Trang tự kiểm tra key trước khi lưu.
                </li>
                <li>
                  <span className="font-mono text-brand-200">2.</span> Vào{" "}
                  <Link href="/studio" className="text-gold-200 underline">
                    /studio
                  </Link>{" "}
                  sinh bài giảng, rồi mở trong{" "}
                  <Link href="/lesson" className="text-gold-200 underline">
                    trình phát
                  </Link>{" "}
                  để tua thử.
                </li>
              </ol>
            </div>
            <Magnetic className="shrink-0">
              <Link href="/lesson" className="btn-gold px-6 py-3.5 text-base">
                Thử tua một bài giảng <ArrowRight className="h-4 w-4" />
              </Link>
            </Magnetic>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
