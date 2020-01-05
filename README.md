<p align="center">
<img src="icons/128.png">
</p>

StreamBlend is a browser extension that blends your [Mixer](http://mixer.com), [Twitch](https://www.twitch.tv), and [YouTube](https://www.youtube.com) follows into one list, and merges them into the twitch sidebar.

If you have questions, concerns, need help, or just want to say hi, you can reach us at streamblend@gmail.com.

## How To Use
1. Install the extension from the [Google Web Store](https://chrome.google.com/webstore/detail/streamblend/pnmdaomfddabinbchojcemjbmnaekbnf) or [Firefox Addon Store](https://addons.mozilla.org/en-US/firefox/addon/streamblend/).
2. Add your follows.
    - Click on the StreamBlend icon in the browser toolbar.
    - Click Settings.
    - Click Link Mixer, Link Twitch, etc. (No data is sent to us. Only between you and the website.)
3. Click on the StreamBlend icon in the browser toolbar to see your follows, or visit [Twitch.tv](https://www.twitch.tv) to see your follows merged in the sidebar.

## Help Out
StreamBlend is free and open source! You can help by contributing a pull request, filling out a bug report, sending an email, or by donating to show your support and allow us to put more time into it.

[![paypal](https://www.paypalobjects.com/en_US/i/btn/btn_donate_LG.gif)](https://www.paypal.me/DiegoAce)

## Bugs or Feature Requests
Head over to the [Issues](https://github.com/DiegoAce/StreamBlend/issues) page and create a new issue. We appreciate it!

## How to Build
1. Make sure you have `python3` and [browserify](http://browserify.org/) installed.
2. Create client keys from websites like [Mixer OAuth](https://mixer.com/lab/oauth). (Either change or make sure your `redirectUri` matches those in `src/agents.js`)
3. Add your keys to `src/keysExample.js`, and rename it to `keys.js`
4. Open up a terminal and `cd` to the `build` folder of this repo.
5. Run the command: `./build debug` or `./build release`.
