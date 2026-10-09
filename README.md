# Doodle

Doodle is a simple web based drawing app, in which you can do simple doodling <br/>

## Features

- The Main feature is the colour picker, it gives you both darker and lighter value of the color you choose you can choose from preset of put a hex code and has a color picker
- Pen pressure that you can toggle, on by default
- A minimap that shows what you are drawing, it only shows what the free hand drawing tool shows
- All other basic features that should be in a drawing app

### What was hard?

- Implementing the eraser was challenging because it had to remove existing strokes without affecting the rest of the drawing. I used the Canvas API's `destination-out` compositing mode and made sure erased areas stayed erased when the infinite canvas was redrawn or zoomed.

- I wanted the color selector to be more flexible than a basic color picker, adding custom HEX colors, different shades, and an eyedropper tool some extra work, but that lwk made it so much better than a simple color selector

### Use of Ai

- Ai was mainly used for debugging and to act as an teacher, when i messed up something i would ask it about what happened, how i can fix it, why is happened, like that. Also all the code is written by me, and i have kept my usage of Ai under that limit, cus most of the time I just google the stuff i want
