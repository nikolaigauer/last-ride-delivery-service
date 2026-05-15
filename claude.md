# Last Ride Delivery Service

A dark comedy noir game inspired by Aki Kaurismäki films, where you play as a solitary undertaker delivering coffins (with corpses!) through increasingly chaotic terrain. The twist: physics-based disasters, bumpy roads, and the constant threat of losing your cargo in the most undignified ways possible.

> **📋 Project Memory & Context**: See `PROJECT_MEMORY.json` for collaboration dynamics, relationship context, artistic direction, and project philosophy that should inform all development work.

## Project Overview

**Genre:** 2D physics-based dark comedy/arcade  
**Engine:** Vanilla JavaScript + HTML5 Canvas  
**Art Style:** Black & white, minimalist line art with green glow effects  
**Tone:** Noir solitude meets slapstick physics disasters

### Core Game Loop Vision
1. **Phone Booth** - Receive delivery instructions from dispatch
2. **Pickup Location** - Collect corpse and coffin from morgue/hospital  
3. **Treacherous Journey** - Navigate terrain while keeping everything intact
4. **Delivery** - Arrive at funeral service with dignity... hopefully
5. **Repeat** - New level with increased difficulty/chaos

The humor comes from escalating physics disasters:
- Hearse tilts on steep terrain → Coffin slides out  
- Coffin bounces around → Lid pops open from impacts
- Corpse ragdolls out → Must collect and reload everything
- Witness to absurd moments between life's most solemn events

### Planned Game Loop Implementation (December 2024)
**Mission Start:**
- Player begins IN hearse (streamlined start)
- Ringing phone booth with glow effect signals interaction
- Exit hearse, interact with phone for dispatch instructions

**Phone Dispatch:**
- Simple text overlay: *"We got a pickup at Miller's Funeral Home, delivery to Hillside Cemetery. Try to keep 'em dignified this time..."*
- Mission waypoint: *"→ Drive east to pickup location"*

**Pickup → Delivery:**
- Drive to funeral home building (coffin + corpse spawn on arrival)
- Load cargo using existing mechanics
- Navigate terrain hazards (potholes, jumps, rough roads)
- Deliver to cemetery destination

**Dignity Meter Scoring:**
- Track total bumps/damage during transport mission
- **Perfect delivery** (0-2 bumps): "Exemplary service! The family was moved."
- **Rough delivery** (3-7 bumps): "Family was... understanding about the condition."
- **Disaster delivery** (8+ bumps): "We're getting calls. Do better next time."

**Mission Completion:**
- Atmospheric feedback based on delivery dignity score
- Option for new mission or performance-based game progression

---

## Current State ✅ (December 2024)

### Phase 1: Core Physics System - COMPLETE
- **Stickman player** with walk cycle animation (green glow effect)
- **Hearse entry/exit** (spacebar) with proper positioning
- **Driving controls** (arrow keys while in hearse) 
- **Corpse pickup/drop** - Gray ragdoll corpse entity
- **Corpse → Coffin loading** with 0.5s lid opening animation
- **Coffin → Hearse loading** with 0.5s door opening animation
- **Hearse bump system** - 5 direction changes → door opens permanently
- **Coffin ejection** - Slides out back when door opens (with physics!)
- **Coffin bump system** - 6 cumulative impacts → lid opens permanently (only *severe* hearse bumps transmit through; +2 added on ejection)  
- **Corpse ejection** - Flies out when coffin lid opens (with velocity!)
- **Bump memory** - Coffin remembers damage between hearse loads
- **Smooth camera** following player/hearse
- **Procedural hilly terrain** for testing physics
- **Debug overlay** showing all system states
- **Enhanced UI prompts** for all interactions
- **Terrain boundary fixes** for consistent physics anywhere
- **Enhanced Ragdoll System** - 24 anatomical joints with realistic physics
- **Black silhouette corpse** - Matches hearse driver aesthetic
- **Adjustable corpse scaling** - Easy resize via `setCorpseScale()` and `setCorpseSize()`

### Current Gameplay Flow
1. Pick up corpse → Load into coffin (lid closes)
2. Pick up coffin → Load into hearse (door closes)  
3. Drive and accumulate bumps → Door opens at threshold
4. Coffin slides out (+2 bumps) → Usually triggers lid opening
5. Corpse flies out with physics → **Enhanced ragdoll with 24 joints flops around!**
6. Player must collect everything and reload

### Bug Fixes & Enhancements (December 2024)
- **Fixed "Schrödinger's Corpse" bug**: Corpse ragdoll body parts weren't being moved to coffin position when spawned by hospital. Only reference coords were set, leaving body parts at x=-1000 (off-screen). Fix: Use `moveToPosition()` instead of direct coordinate assignment in `Hospital.spawnCargo()`.
- **Fixed hospital placement on jagged terrain**: Hospital now properly uses flattened terrain around x=2500 location
- **Added detached head pickup system**: Detached heads can now be picked up and loaded into coffins just like the main body
- **Enhanced body part proximity tracking**: Debug display shows status of both body and head parts for complete coffin loading
- **Fixed mission text going out of bounds**: Added text wrapping system with proper word boundaries
- **Implemented coffin removal from hearse**: Player can now unload coffin from hearse for bridge puzzle mechanics
- **Built complete ravine bridge puzzle system**: Scale bridge with weight physics, visual feedback, and failure states

### Enhanced Ragdoll Features ✅ (December 2024)
- **24 anatomical joints**: Head, neck, shoulders, upper/lower arms, elbows, wrists, hands, chest sections, stomach, hips, thighs, knees, shins, ankles, feet
- **Realistic physics constraints**: Different movement limits for each joint type
- **Black silhouette rendering**: Matches hearse driver aesthetic from walk cycle
- **Adjustable sizing**: `game.setCorpseScale(1.5)` or `game.setCorpseSize(width, height)`
- **Enhanced movement**: Extremities flop more, core body parts move less
- **Joint-specific damping**: Neck limited rotation, knees/elbows can't over-extend



### File Structure
```
STICKMAN/
├── index.html           # Main game entry point
├── claude.md            # This file
├── css/styles.css       # Game styling
├── js/                  # Modular JavaScript files
│   ├── Game.js          # Main game orchestration
│   ├── Physics.js       # Matter.js engine wrapper
│   ├── Player.js        # Player character
│   ├── Hearse.js        # Hearse — Matter composite (chassis + 2 wheels)
│   ├── Coffin.js        # Coffin — Matter body when free on terrain
│   ├── Corpse.js        # Enhanced ragdoll system
│   ├── Terrain.js       # Procedural terrain generation
│   ├── Input.js         # Input management
│   ├── Utils.js         # Utility functions
│   └── main.js          # Game initialization
└── assets/
    ├── cycle3.png           # Stickman walk cycle spritesheet
    ├── hearse.png           # Hearse with closed door
    ├── open-door-hearse.png # Hearse with open back door
    ├── closed-coffin.png    # Coffin with lid closed
    ├── open-coffin.png      # Coffin with lid open
    ├── phone.png            # Phone booth (earpiece on hook)
    ├── phone-hanging.png    # Phone booth (earpiece hanging)
    ├── pothole1.png         # Terrain hazard assets
    ├── pothole2.png         # (for mission obstacles)
    ├── pothole3.png
    └── pothole4.png
```

---

## Ravine Bridge Puzzle Design

### Bridge Puzzle Mechanics (Planned Implementation)
**Location**: Great Canyon section (50-60% of world, around x=12500-15000)
**Core Problem**: Hearse is too heavy to cross the collapsing bridge alone
**Solution**: Use coffin as counterweight to activate draw bridge mechanism

#### Bridge Physics System:
1. **Scale Bridge Structure**: 
   - Bridge acts as a balance scale/see-saw with pivot point in center
   - Left side: loading platform for coffin weight 
   - Right side: hearse crossing area
   - Bridge starts tilted DOWN on hearse side (uncrossable)
   - Adding coffin weight tips bridge UP on hearse side (crossable)

2. **Required Actions**:
   - Remove coffin from hearse (new mechanic needed)
   - Place coffin on left platform as counterweight  
   - Drive hearse across raised right side
   - Retrieve coffin from other side (careful not to retip bridge)
   - Reload coffin and continue journey

#### Visual Design:
- **Art Deco styling**: Industrial suspension cables, geometric supports
- **Anticipatory tension**: Player can SEE the mechanism, understands what must be done
- **"Oh no!" moments**: Bridge visibly creaking, swaying as hearse approaches
- **Failure consequences**: Fall into ravine = restart from checkpoint

#### Implementation Requirements:
1. **Coffin removal system** - Allow taking coffin out of hearse
2. **Bridge tilt physics** - Calculate weight balance and angle
3. **Platform interaction** - Designated weight placement zones
4. **Bridge collision** - Hearse can only cross when properly angled
5. **Failure state handling** - Ravine fall detection and respawn

#### Comedy Moments:
- **Plan vs Reality**: Careful coffin placement... then hearse bumps bridge and everything slides
- **Weight miscalculation**: Bridge tips TOO far, now coffin slides into ravine  
- **Corpse complications**: If head detached, need to bring both pieces for full weight
- **Bridge sway**: High wind effects that mess up careful weight positioning

This creates the perfect "anticipatory disaster" - player sees exactly what needs to happen, but physics chaos intervenes with their careful plans.

---

## Narrative & Puzzle Concepts (Brainstorming)

### Roadkill Substitution Scene
**Setup**: Mid-journey disaster where the actual corpse becomes unusable

**Scenario Flow**:
1. Hit roadkill on road (deer, large animal) - physics impact causes hearse chaos
2. Original corpse gets ejected/damaged beyond recognition OR goes missing entirely  
3. Player discovers the problem - can't proceed with delivery as-is
4. Roadkill lies nearby - similar size, conveniently ambiguous when wrapped
5. **Dark Choice**: Substitute the roadkill for the corpse to complete the delivery

**Tonal Balance**:
- Dark enough to feel transgressive but absurd enough to stay comedic
- Visual ambiguity once "packaged" maintains plausible deniability  
- Dispatcher's oblivious response adds to gallows humor
- Success/failure based on how well player "sells" the substitution

**Implementation Ideas**:
- Roadkill could be a separate ragdoll entity (different joint structure?)
- Coffin inspection mini-game if suspicion arises
- Consequences range from "nobody noticed" to "banned from cemetery"
- Could tie into "dignity meter" - desperate measures from accumulated disasters

**Narrative Context**: 
How do we set this up? Lead-up events that make the choice feel inevitable vs. calculated. Does the corpse disappear mysteriously (darker) or get destroyed visibly (slapstick)? What are the consequences of making/refusing this choice?

---

## Technical Notes

### Coordinate System
- World is 10000px wide, camera follows player/hearse
- Hearse faces RIGHT (cab on right side of sprite)
- Back door is on LEFT side of hearse sprite
- `hearse.x` = left edge = back door position

### Key Game Objects
```javascript
player: { x, y, width, height, speed, isMoving, direction, inVehicle }
hearse: { x, y, width, height, speed, doorOpen, doorOpenedByBump, bumpCounter, bumpThreshold, doorTimer }
coffin: { x, y, width, height, isOpen, isPickedUp, inHearse, velocityY, groundY }
corpse: { x, y, width, height, scale, joints: { head, neck, shoulders, arms, elbows, wrists, hands, chest, hips, legs, knees, ankles, feet } }
```

### Interaction Zones
- **Coffin pickup**: Within 60px of coffin
- **Hearse entry**: Within 80px of hearse (when not carrying coffin)
- **Coffin loading**: Within 60px of hearse's LEFT edge (back door)

### Door State Logic
- `doorOpen`: Visual state (which sprite to show)
- `doorOpenedByBump`: If true, door stays open permanently
- `doorTimer`: Countdown for auto-close after loading animation

---

## Development Roadmap

### Phase 2: Matter.js Physics Migration ✅ COMPLETE (May 2026)
**Goal**: Replace hand-rolled vehicle physics with Matter.js rigid-body simulation

#### What was done:
- [x] **Matter.js engine**: Running every frame via `js/Physics.js` wrapper
- [x] **Terrain as static bodies**: 312 rotated rectangles, one per landscape segment
- [x] **Hearse as Matter composite**: Chassis (180×50) + 2 wheel circles + spring-axle constraints
- [x] **Hearse tilt**: Reads `chassis.angle` directly — no more lerp or stability corrections
- [x] **Airborne detection**: Via `collisionStart`/`collisionEnd` wheel contact counting
- [x] **Bump scoring**: Real terrain impact velocity from collision events, not direction changes
- [x] **Coffin as Matter body**: Dynamic body enters/leaves world based on carry state
- [x] **Coffin tumble**: `tiltAngle = body.angle` renders coffin rotating on ejection
- [x] **Corpse↔Matter bridge**: `coffin.velocityX = body.velocity.x` propagates real impulses to Verlet ragdoll
- [x] **Corpse.js unchanged**: Still Verlet integration with `getGroundYAt()` — do not replace

#### Physics architecture:
```
Matter.js Engine (gravity y=1.0)
  - Static: terrain (~312 rectangles) + boundary walls
  - Composite: hearse chassis + wheelA + wheelB + 2 axle constraints
  - Dynamic: coffin (when free on ground)
        ↓ impulses via coffin.velocityX
Corpse.js — unchanged Verlet ragdoll (reads Terrain.getGroundYAt)
```

#### Key property mappings (Matter → game state, updated each frame):
- `hearse.x/y` ← `chassis.position.x/y - offsets`
- `hearse.velocity` ← `chassis.velocity.x`
- `hearse.tiltAngle` ← `chassis.angle`
- `hearse.isAirborne` ← `_wheelContacts === 0`
- `coffin.x/y` ← `body.position.x/y - halfDimensions`
- `coffin.velocityX/Y` ← `body.velocity.x/y`

### Phase 3: Enhanced Ragdoll Physics & Visual Polish
**Goal**: Dynamic corpse physics and visual interaction cues ✅ **LARGELY COMPLETE**

#### Ragdoll Enhancement:
- [x] **Enhanced joint system**: 24 anatomical joints with realistic physics
- [x] **Black silhouette style**: Matches hearse driver aesthetic perfectly
- [x] **Joint constraints**: Realistic body part movement limits
- [x] **Adjustable scaling**: Easy size customization for sprite matching
- [x] **Bouncy tumbling**: Corpse spins and bounces realistically
- [ ] **Limb separation**: Arms/legs detach and flop independently (future enhancement)
- [ ] **Damage states**: Visual degradation from repeated impacts

#### Visual Language System: ✅ **COMPLETE**
- [x] **Proximity glow effects**: Replace text prompts with visual cues
- [x] **Hearse door glow**: Back door glows when carrying coffin nearby  
- [x] **Hearse cab glow**: Front door glows when ready to enter
- [x] **Entity highlighting**: Corpse/coffin glow when in pickup range
- [x] **Interactive zones**: Visual feedback for all spacebar interactions
- [x] **Refined proximity thresholds**: More precise interaction zones
- [x] **Dashed outline overlays**: Clear door highlighting on hearse

### Phase 4: Game World & Phone Booth System
**Goal**: Complete game loop with Kaurismäki-inspired atmosphere

#### Phone Booth Mechanics:
- [ ] **Ringing phone booth**: Proximity detection and interaction
- [ ] **Dispatch system**: Text-based job instructions 
- [ ] **Level briefings**: Pickup location, destination, special notes
- [ ] **Atmospheric dialogue**: Noir-style dispatcher personality

#### World Building:
- [ ] **Pickup locations**: Morgue, hospital, funeral home variants
- [ ] **Destination markers**: Cemetery, church, family home locations
- [ ] **Journey structure**: Linear progression with save points
- [ ] **Environmental storytelling**: Visual details that build atmosphere

### Phase 5: Level Design & Terrain Variety
**Goal**: Diverse, challenging routes with personality

#### Terrain Types:
- [ ] **Rolling countryside**: Gentle hills, pastoral disasters
- [ ] **Mountain switchbacks**: Hairpin turns, steep drops  
- [ ] **Urban obstacles**: Potholes, construction, tight spaces
- [ ] **Weather conditions**: Rain = slippery physics

#### Level Concepts:
1. **Tutorial Run**: Flat suburban route, learn the basics
2. **Hills of Sorrow**: Rolling terrain, bump management
3. **Widow's Peak**: Mountain pass with steep descents  
4. **Pothole Alley**: Urban nightmare of road hazards
5. **The Final Mile**: Multi-terrain gauntlet for experienced players

### Phase 6: Challenge & Comedy Redesign ⬅️ ACTIVE DEVELOPMENT
**Goal**: Create anticipatory comedy through visible failure setups

#### Priority Demo Challenges:
- [ ] **Collapsing Bridge**: Race across before it falls - visible countdown/cracks
- [ ] **Cliff Cargo Retrieval**: Coffin/corpse falls off cliff, must climb down to retrieve
- [ ] **Failure State Pits**: Game-over consequences for poor driving
- [ ] **Ferry Timing Challenge**: Automatic ferry crossing with precise boarding windows

#### Atmospheric Design Elements:
- [ ] **Pixel Skull Dispatcher**: Animated jaw, speaks mission text in sky
- [ ] **Art Deco Buildings**: Consistent architectural style for world identity  
- [ ] **Visual Identity System**: Line thickness, edge hardness, typography consistency
- [ ] **Psychedelic Sonic Mode**: Departure from realism for stunt challenges

#### Comedy System Features:
- [ ] **Telegraphed Disasters**: Player sees what's coming, builds anticipation
- [ ] **Plan vs Reality Moments**: Careful approaches failing due to physics chaos
- [ ] **"Oh No!" Timing**: Visible setups before predictable disasters strike

### Phase 7: Audio & Polish 
**Goal**: Complete the noir comedy experience ✅ **LARGELY COMPLETE**

#### Sound Design: ✅ **IMPLEMENTED**
- [x] **Ambient audio**: Procedural engine sounds, impact effects
- [x] **Physics sounds**: Corpse impacts, door mechanics  
- [x] **Interactive feedback**: Door creaks, engine dynamics
- [x] **Dynamic music**: 80s jazz fusion ambient background

#### Polish Elements:
- [ ] **Title screen**: Minimalist noir aesthetic
- [ ] **Level transitions**: Smooth scene changes
- [ ] **Score/progress system**: Performance tracking ✅ **IMPLEMENTED**
- [ ] **Settings menu**: Audio, visual options

---

## Art Assets TODO

Priority order:
1. **hearse.png** - CLOSED door version (BLOCKING)
2. ~~**corpse.png** - Limp/dead stickman sprite~~ ✅ **REPLACED WITH PROCEDURAL RAGDOLL**
3. **terrain tiles?** - Or keep procedural
4. **UI elements** - Start button, level markers, etc.

---

## Code Conventions

- All game code in single HTML file (inline `<script>`)
- ES6 class-based structure (`StickmanGame` class)
- Game loop: `update()` → `render()` → `requestAnimationFrame`
- Positions in world coordinates, converted to screen coords for rendering
- Debug overlay can be toggled off for release (currently always on)

---

## Notes for Future Sessions

When resuming work:
1. Check if `hearse.png` has been updated with closed door
2. Debug panel shows current game state - use it!
3. Console logs proximity checks and bump detection
4. The "LOAD ZONE" green dashed box shows coffin loading area

Key files to examine:
- `stickman-game.html` lines 121-184: Enhanced corpse ragdoll definition (24 joints)
- `stickman-game.html` lines 358-389: Enhanced ragdoll physics with joint constraints
- `stickman-game.html` lines 945-1255: New black silhouette corpse rendering system
- `stickman-game.html` lines 1351-1369: Corpse scaling utility methods
- Console commands: `game.setCorpseScale(1.2)` or `game.setCorpseSize(50, 80)`

---

## Future Ragdoll Enhancement Ideas

### Advanced Physics Features:
- **Limb detachment**: Arms/legs can separate from body on high-impact collisions
- **Cloth physics**: Add fabric simulation for clothing that flows with movement  
- **Bone breaking**: Joint damage system where repeated impacts affect movement
- **Decay states**: Visual degradation over time (for dark comedy effect)
- **Multiple corpse types**: Different body types, sizes, clothing styles

### Visual Enhancements:
- **Particle effects**: Dust clouds, fabric tears, bone cracks on impacts
- **Motion blur**: Speed lines during high-velocity ragdoll motion
- **Facial expressions**: Procedural face changes based on physics state
- **Clothing variation**: Hats, ties, jackets that can fall off independently

### Gameplay Integration:
- **Damage scoring**: Points for keeping corpse intact vs. comedy chaos
- **Corpse identification**: Different corpses have different physics properties
- **Assembly challenge**: Must reassemble dismembered corpse before delivery
- **Dignity meter**: Visual indicator of how "presentable" corpse remains

### Technical Improvements:
- **Performance optimization**: LOD system for distant ragdolls
- **Collision layers**: More sophisticated body part interactions
- **Joint spring system**: More realistic limb connections
- **Ground interaction**: Corpse limbs interact with terrain bumps
