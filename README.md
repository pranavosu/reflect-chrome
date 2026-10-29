<p align="center">
    <h1 align="center" >reflect.</h1>
    <p align="center">
        "a mindful website blocker for the productive."
    </p>
    <div align="center">
        <a href="https://getreflect.app/">Learn More</a> | <a href="https://chrome.google.com/webstore/detail/reflect-a-mindful-website/bicebchdpeichdlmoaflplakefkjkade">Install for Chrome</a> | <a href="https://addons.mozilla.org/en-US/firefox/addon/reflect-app/">Install for Firefox</a>
    </div>
    <br />
    <img src="assets/video_demo.gif" alt="Video Demo">
</p>

reflect is a digitally mindful chrome extension that encourages users to reflect on their relationship with technology.

when you attempt to visit distracting websites, reflect will ask you what your intention in doing so is. if you have a valid reason, you are allowed to enter the website; if not, you are encouraged to reflect further.

## Building the project
1. Install the package dependencies by doing `npm i`
2. Run `npm run build`
3. Load the extension in the Chrome Extensions menu (Chrome 120 or newer)
   * Go to extensions > enable developer mode (top right corner)
   * Click load unpacked, select the `dist` folder
## Developing
When developing, you will likely want to use a different workflow that is slightly faster. This assumed you already 1) Have all the dependencies installed 2) Have run `npm run build` once already and 3) Have the extension installed

1. Run `npm run watch`
2. Reload extension in the Chrome Extensions menu
   * Go to extension > under reflect, press the refresh icon

Run the unit tests with `npm test`. They cover site matching, storage helpers, model loading, and pin the original model's tokenizer to its exact output.

### Intent models

reflect decides whether an intent is productive with one of two models, picked under "smart model." on the options page:

- **Original (default).** The 2020 LSTM classifier in `dist/res/models/acc85.95`, run by a small dependency-free TypeScript forward pass in `src/nn.ts`. It knows about 840 words and answers instantly.
- **Smart (opt-in).** The [all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) sentence-embedding model, run on-device by [Transformers.js](https://github.com/huggingface/transformers.js), plus a small logistic-regression head in `dist/res/models/minilm-l6-head.json`. The embedding model (about 23 MB) downloads from Hugging Face the first time it is enabled and is cached by the browser after that. If it can't load, reflect falls back to the original model.

The smart model's head is trained on the original reflect data from [reflect-nlp](https://github.com/jackyzha0/reflect-nlp) (AGPL-3.0). To retrain it:

```shell
npm run train:smart-head
```

Build output (`dist/src/` and ONNX Runtime's WebAssembly file in `dist/ort/`) is not checked in, so run `npm run build` after cloning, before loading the extension.
