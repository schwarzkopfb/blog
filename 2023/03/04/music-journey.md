# My journey and current state of making music

Once upon a time in high-school I attended to [Chris Palmer](https://open.spotify.com/artist/28VnidW62NnJOQAExf4HH6?si=HxFWu6pnR32gurroH0iscA)'s piano and "computer assisted music making" classes and earnt a certificate. I played a piano interpretation of Don't You Worry Child by Swedish House Mafia with beautyful vocals from my classmate Kitti at our graduation ceremony.

Then I started the uni and I also had to get a job to pay the cost of my studies and living, so I didn't really have time and money to continue this hobby. I followed the news about electronic music production, broadened my musical repertoire and met with friends from time to time for some jamming However I did not put too much effort into this "music making thingy" (as I referred to it).

After ~6 years spent like this, something really inspiring happened. I started working at [Prezi](https://prezi.com), a company which is famous about its culture. [Alex Szabo](https://www.linkedin.com/in/alxszabo/) organized the first Gadget Petting Zoo™ event inside Prezi. That was about bringing your own tools, wiring them together somehow and making sounds that can be identified as music. That was an open event inside the company and you were able to join even if you don't had musical equipment.

[Tom Bean](https://www.linkedin.com/in/tkbean/) showed up with an [op-z](https://teenage.engineering/products/op-z). I knew a lot about that live act workhorse but didn't have a chance to try it out. I can truly say that this gadget is even more amazing when you can gat your hands on it. So I decided to get my own.

The next logical step was to create some webscraper scripts to continously scan used instrument marketplaces. And after a few weeks, I just got a notification about a great deal. The next day I bought my own op-z!

Since then I have a lot of fun exploring this amazing piece of hardware and making music with it. I also started to build my DAWless setup.

My primary goal here is to be able to go out for a night to play somewhere with only one backpack. (Speakers and stuff excluded of course.) I went through a lot of gears for controlling the op-z, like [Novation Launch Control XL](https://novationmusic.com/en/launch/launch-control-xl) and [MPK mini](https://www.akaipro.com/mpk-mini-mkii)  to unleash the potential of this genius little synth/sampler/sequencer. 

<img src="./launch.png" />
Then I just spotted [intech.studio](https://intech.studio/)'s brilliant grid controller in [this video](https://www.youtube.com/watch?v=S2LzUNaYzWY&t=1291s&ab_channel=SpaceTown). That was huge! 
It's a programmable tiny controller (that fits in your backpack easily!) and can be a perfect companion for op-z. I ordered my first grid unit almost immeadiately, spent a weekend on writing some lua code and that worked perfectly!
<img src="./mapping.png" /><img src="./wired_together.png" />

Got motivated, so I started to get the full potential of the grid system. The guys at Intech just gave me some other units to experiment with so I ended up having The Perfect DAWless setup with op-z! Having a dedicated encoder for each param of the selected instrument, full control on the output level of each channel and many more handy utils. Wired together with a Kingston Nucleum and having an old iPad as a display (connected via Blouetotth LE) it's just perfect to play live.
<img src="./planning.png" /><img src="./setup.png" />

I'll share the source code with the Intech guys soon, so they'll be able to publish it officially as a Grid profile for OP-Z, so anyone interested will be able to download it.

My next step in building my electronic music setup will be figuring out how should I connect my OP-Z line module with the Grid to be able to turn on/off cue on a given channel by a push of an encoder. It would be great to be able to toggle cueing throug the line module by sending some MIDI cc messages.