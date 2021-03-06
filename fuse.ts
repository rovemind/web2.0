import { fusebox, sparky, pluginReplace } from "fuse-box";
import * as path from "path"

class Context {
  runServer: boolean;
  env: {
    NODE_ENV: "development" | "production",
    STORAGE_NODE_VERSION: "beta" | "production"
  }
  getConfig = () =>
    fusebox({
      target: "browser",
      entry: "src/index.tsx",
      webIndex: {
        template: "src/index.html"
      },
      cache: true,
      devServer: this.runServer,
      plugins: [
        pluginReplace(/node_modules\/bn\.js\/.*/, {
          "require('buffer')": "require('" + require.resolve("./node_modules/buffer") + "')",
        }),
        pluginReplace(/node_modules\/readable-stream\/.*/, {
          "require('util')": "require('" + require.resolve("./node_modules/util") + "')",
        }),
        pluginReplace(/node_modules\/readable-stream\/.*/, {
          "require('stream')": "require('" + require.resolve("./node_modules/stream-browserify") + "')",
        })
      ],
      env: this.env
    });
}

const { task, src, exec, rm } = sparky<Context>(Context);

task("remove-artifacts", async () => {
  rm("dist")
  rm(".cache")
})

task("copy-streamsaver", async () => {
  await src("node_modules/streamsaver/{mitm.html,sw.js}")
    .dest("dist/resources/streamsaver", path.join(__dirname, "node_modules/streamsaver"))
    .write()
    .exec()
})

task("default", async ctx => {
  await exec("run-dev-beta")
})

task("run-dev-prod", async ctx => {
  await exec("remove-artifacts")

  ctx.runServer = true;
  ctx.env = {
    NODE_ENV: "development",
    STORAGE_NODE_VERSION: "production",
  }
  const fuse = ctx.getConfig();

  await exec("copy-streamsaver")
  await fuse.runDev();
});

task("run-dev-beta", async ctx => {
  await exec("remove-artifacts")

  ctx.runServer = true;
  ctx.env = {
    NODE_ENV: "development",
    STORAGE_NODE_VERSION: "beta",
  }
  const fuse = ctx.getConfig();

  await exec("copy-streamsaver")
  await fuse.runDev();
});

task("run-prod-beta", async ctx => {
  await exec("remove-artifacts")

  ctx.runServer = true;
  ctx.env = {
    NODE_ENV: "production",
    STORAGE_NODE_VERSION: "beta",
  }
  const fuse = ctx.getConfig();

  await exec("copy-streamsaver")
  await fuse.runProd({ uglify: false });
});

task("run-prod-prod", async ctx => {
  await exec("remove-artifacts")

  ctx.runServer = true;
  ctx.env = {
    NODE_ENV: "production",
    STORAGE_NODE_VERSION: "production",
  }
  const fuse = ctx.getConfig();

  await exec("copy-streamsaver")
  await fuse.runProd({ uglify: false });
});

task("dist-prod-beta", async ctx => {
  await exec("remove-artifacts")

  ctx.runServer = false;
  ctx.env = {
    NODE_ENV: "production",
    STORAGE_NODE_VERSION: "beta",
  }
  const fuse = ctx.getConfig();

  await exec("copy-streamsaver")
  await fuse.runProd({ uglify: false });
});

task("dist-prod-prod", async ctx => {
  await exec("remove-artifacts")

  ctx.runServer = false;
  ctx.env = {
    NODE_ENV: "production",
    STORAGE_NODE_VERSION: "production",
  }
  const fuse = ctx.getConfig();

  await exec("copy-streamsaver")
  await fuse.runProd({ uglify: false });
});
