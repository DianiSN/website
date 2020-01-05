const autoprefixer = require("autoprefixer");
const browserSync = require("browser-sync").create();
const cp = require("child_process");
const cssnano = require("cssnano");
const csso = require("postcss-csso");
const del = require("del");
const gulp = require("gulp");
const htmlmin = require("gulp-htmlmin");
const hugoBin = require("hugo-bin");
const imagemin = require("gulp-imagemin");
const log = require("fancy-log");
const PluginError = require("plugin-error");
const postcss = require("gulp-postcss");
const sass = require("gulp-sass");
const sourcemaps = require("gulp-sourcemaps");
const webpack = require("webpack");
const webpackConfig = require("./webpack.prod");
const webpackDevConfig = require("./webpack.dev");

// DEV: Compress SASS
// Does not purify it since that takes longer
gulp.task("sass", () => {
  return gulp
    .src("./assets/sass/styles.scss")
    .pipe(
      sass({
        outputStyle: "compressed"
      }).on("error", sass.logError)
    )
    .pipe(gulp.dest("./dist/assets/css"))
    .pipe(browserSync.stream());
});

// PROD: Compress SASS
gulp.task("sass-minify", () => {
  return gulp
    .src("./assets/sass/styles.scss")
    .pipe(
      sass({
        outputStyle: "compressed"
      }).on("error", sass.logError)
    )
    .pipe(postcss([autoprefixer(), cssnano(), csso()]))
    .pipe(sourcemaps.write("."))
    .pipe(gulp.dest("./dist/assets/css"))
    .pipe(browserSync.stream());
});

// DEV: Move images
gulp.task("img", () => {
  return gulp.src("./assets/img/**/*").pipe(gulp.dest("./dist/assets/img"));
});

// PROD: Move & minify images
gulp.task("img-minify", () => {
  return gulp
    .src("./assets/img/**/*")
    .pipe(imagemin())
    .pipe(gulp.dest("./dist/assets/img"));
});

// DEV & PROD: Compile Javascript
gulp.task("js", (done) => {
  const environment = process.env.NODE_ENV;
  log("ENVIRONMENT: " + environment);
  let myConfig = {};
  if (environment === "dev") {
    myConfig = Object.assign({}, webpackDevConfig);
  } else {
    myConfig = Object.assign({}, webpackConfig);
  }
  webpack(myConfig, (err, stats) => {
    if (err) throw new PluginError("webpack", err);
    log(
      "[webpack]",
      stats.toString({
        colors: true,
        progress: true
      })
    );
    browserSync.reload();
  });
  done();
});

// PROD: Minify HTML
gulp.task("html-minify", () => {
  return gulp
    .src("./dist/**/*.html")
    .pipe(
      htmlmin({
        collapseBooleanAttributes: true,
        collapseWhitespace: true,
        conservativeCollapse: true,
        decodeEntities: true,
        html5: true,
        includeAutoGeneratedTags: false,
        minifyJS: true,
        removeComments: true,
        removeRedundantAttributes: true
      })
    )
    .pipe(gulp.dest("./dist"));
});

// DEV & PROD: Clean up dist
gulp.task("clean", () => {
  return del(["dist"]);
});

// DEV & PROD: Move PDF
gulp.task("pdf", () => {
  return gulp.src("./assets/pdf/**/*").pipe(gulp.dest("./dist/assets/pdf"));
});

// DEV & PROD: Server with browsersync
const runServer = (options) => {
  browserSync.init({
    server: {
      baseDir: "./dist"
    }
  });
  gulp.watch("./assets/js/**/*.js", gulp.series("js"));
  gulp.watch("./assets/sass/**/*.scss", gulp.series("sass"));
  gulp.watch("./assets/img/**/*", gulp.series("img"));
  gulp.watch(
    [
      "./content/**/*",
      "./data/**/*",
      "./i18n/**/*",
      "./layouts/**/*",
      "./resources/**/*",
      "./static/**/*",
      "./config.toml"
    ],
    gulp.series(options)
  );
};

// DEV & PROD: Run Hugo
const buildSite = (done, options, environment) => {
  const args = options ? hugoArgsDefault.concat(options) : hugoArgsDefault;
  process.env.NODE_ENV = environment;
  return cp
    .spawn(hugoBin, args, {
      stdio: "inherit"
    })
    .on("close", (code) => {
      if (code === 0) {
        browserSync.reload();
        browserSync.notify("Your changes were applied :)");
        done();
      } else {
        browserSync.notify("The Hugo build failed :(");
        done("Hugo build failed");
      }
    });
};

// Hugo arguments
const hugoArgsDefault = ["-d", "./dist", "-s", "./", "--verbose"];
// const hugoArgsDefault = ["-d", "./dist", "-s", "./", "--templateMetrics"];
const hugoArgsPreview = ["--buildDrafts", "--buildFuture"];

// DEVELOPMENT
gulp.task("hugo-dev", (done) => buildSite(done, [], "dev"));

gulp.task("hugo-preview", (done) => buildSite(done, hugoArgsPreview, "dev"));

gulp.task(
  "server",
  gulp.series("hugo-dev", "sass", "img", "js", (done) => {
    runServer("hugo-dev");
    done();
  })
);

gulp.task(
  "server-preview",
  gulp.series("hugo-preview", "sass", "img", "js", (done) => {
    runServer("hugo-preview");
    done();
  })
);

gulp.task("build-dev", gulp.series("clean", "hugo-dev", "sass", "img", "js"));

// PRODUCTION
gulp.task("hugo", (done) => buildSite(done, [], "prod"));

gulp.task(
  "server-prod",
  gulp.series(
    "hugo",
    "img-minify",
    "js",
    "sass-minify",
    "html-minify",
    (done) => {
      runServer("hugo");
      done();
    }
  )
);

gulp.task(
  "build",
  gulp.series("clean", "hugo", "img-minify", "js", "sass-minify", "html-minify")
);
