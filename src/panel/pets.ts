import { PetColor, PetSize, PetType } from "../common/types";
import { ISequenceTree } from "./sequences";
import { IState, States, resolveState, HorizontalDirection, ChaseState, BallState, FrameResult, PetInstanceState, isStateAboveGround, PetElementState } from "./states";

export class InvalidStateException {

}

export class PetElement {
    el: HTMLImageElement;
    collision: HTMLDivElement;
    pet: IPetType;
    color: PetColor;
    type: PetType;
  
    constructor(el: HTMLImageElement, collision: HTMLDivElement, pet: IPetType, color: PetColor, type: PetType){
      this.el = el;
      this.collision = collision;
      this.pet = pet;
      this.color = color;
      this.type = type;
    }
  }

export interface IPetCollection {
    pets(): Array<PetElement>;
    push(pet: PetElement): void;
    reset(): void;
    seekNewFriends(): void;
}

export class PetCollection implements IPetCollection {
    _pets: Array<PetElement>;

    constructor(){
        this._pets = new Array(0);
    }

    pets() {
        return this._pets;
    }

    push(pet: PetElement){
        this._pets.push(pet);
    }

    reset(){
        this._pets = [];
    }

    seekNewFriends() {
        if (this._pets.length <= 1)
            {return;} // You can't be friends with yourself.
        
        this._pets.forEach(petInCollection => {
            if (petInCollection.pet.hasFriend())
                {return;} // I already have a friend!
            this._pets.forEach(potentialFriend => {
                if (potentialFriend.pet.hasFriend())
                    {return;} // Already has a friend. sorry.
                if (!potentialFriend.pet.canChase())
                    {return;} // Pet is busy doing something else.
                if (potentialFriend.pet.left() > petInCollection.pet.left() &&
                    potentialFriend.pet.left() < petInCollection.pet.left() + petInCollection.pet.width())
                    {
                        // We found a possible new friend..
                        console.log(petInCollection.pet.name(), " wants to be friends with ", potentialFriend.pet.name(), ".");
                        petInCollection.pet.makeFriendsWith(potentialFriend.pet);
                    }
            });
        });
    }
}

export interface IPetType {
    nextFrame(): void

    // Special methods for actions
    canSwipe(): boolean
    canChase(): boolean
    swipe(): void
    chase(ballState: BallState, canvas: HTMLCanvasElement): void

    // State API
    getState(): PetInstanceState
    recoverState(state: PetInstanceState): void

    // Positioning
    bottom(): number;
    left(): number;
    positionBottom(bottom: number): void;
    positionLeft(left: number): void;
    width(): number;
    floor(): number;

    // Friends API
    name(): string;
    hasFriend(): boolean;
    friend(): IPetType;
    makeFriendsWith(friend: IPetType): boolean;
    isPlaying(): boolean;
} 

function calculateSpriteWidth(size: PetSize): number{
    if (size === PetSize.nano){
      return 30;
    } else if (size === PetSize.medium){
      return 55;
    } else if (size === PetSize.large){
      return 110;
    } else {
      return 30; // Shrug
    }
  }

abstract class BasePetType implements IPetType {
    label: string = "base";
    sequence: ISequenceTree = { startingState: States.sitIdle, sequenceStates: []};
    currentState: IState;
    currentStateEnum: States;
    holdState: IState | undefined;
    holdStateEnum: States | undefined;
    private el: HTMLImageElement;
    private collision: HTMLDivElement;
    private _left: number;
    private _bottom: number;
    petRoot: string;
    _floor: number;
    _friend: IPetType | undefined;

    constructor(spriteElement: HTMLImageElement, collisionElement: HTMLDivElement, size: PetSize, left: number, bottom: number, petRoot: string, floor: number){
        this.el = spriteElement;
        this.collision = collisionElement;
        this.petRoot = petRoot;
        this._floor = floor;
        this._left = left;
        this._bottom = bottom;
        this.initSprite(size, left, bottom);
        this.currentStateEnum = this.sequence.startingState;
        this.currentState = resolveState(this.currentStateEnum, this);
    }

    initSprite(petSize: PetSize, left: number, bottom: number) {
        this.el.style.left = `${left}px`;
        this.el.style.bottom = `${bottom}px`;
        this.el.style.width = "auto";
        this.el.style.height = "auto";
        this.el.style.maxWidth = `${calculateSpriteWidth(petSize)}px`;
        this.el.style.maxHeight = `${calculateSpriteWidth(petSize)}px`;
        this.collision.style.left = `${left}px`;
        this.collision.style.bottom = `${bottom}px`;
        this.collision.style.width = `${calculateSpriteWidth(petSize)}px`;
        this.collision.style.height = `${calculateSpriteWidth(petSize)}px`;
      }

    left(): number {
        return this._left;
    }

    bottom(): number {
        return this._bottom;
    }

    positionBottom(bottom: number): void
    {
        this._bottom = bottom;
        this.el.style.bottom = `${this._bottom}px`;
        this.el.style.bottom = `${this._bottom}px`;
        this.collision.style.left = `${this._left}px`;
        this.collision.style.bottom = `${this._bottom}px`;
    };

    positionLeft(left: number): void {
        this._left = left;
        this.el.style.left = `${this._left}px`;
        this.el.style.left = `${this._left}px`;
        this.collision.style.left = `${this._left}px`;
        this.collision.style.bottom = `${this._bottom}px`;
    }

    width(): number {
        return this.el.width;
    }

    floor(): number {
        return this._floor;
    }

    getState(): PetInstanceState { 
        return {currentStateEnum: this.currentStateEnum};
    }

    recoverState(state: PetInstanceState){
        this.currentStateEnum = state.currentStateEnum!;
        this.currentState = resolveState(this.currentStateEnum, this);
        if (!isStateAboveGround(this.currentStateEnum)){
            // Reset the bottom of the sprite to the floor as the theme
            // has likely changed.
            this.positionBottom(this.floor());
        }
    }

    canSwipe(){
        return !isStateAboveGround(this.currentStateEnum);
    }

    canChase(){
        return !isStateAboveGround(this.currentStateEnum) && this.currentStateEnum !== States.chase;
    }

    swipe() {
        if (this.currentStateEnum === States.swipe) { return; }
        this.holdState = this.currentState;
        this.holdStateEnum = this.currentStateEnum;
        this.currentStateEnum = States.swipe;
        this.currentState = resolveState(this.currentStateEnum, this);
    }
    
    chase(ballState: BallState, canvas: HTMLCanvasElement) {
        this.currentStateEnum = States.chase;
        this.currentState = new ChaseState(this, ballState, canvas);
    }

    faceLeft() {
        this.el.style.webkitTransform = "scaleX(-1)";
    }

    faceRight() {
        this.el.style.webkitTransform = "scaleX(1)";
    }

    setAnimation(face: string) {
        const newFace: string = `${this.petRoot}_${face}_8fps.gif`;
        if (this.el.src === newFace) {
            return;
        }
        this.el.src = newFace;
    }

    chooseNextState(fromState: States): States {
        // Work out next state
        var possibleNextStates: States[] | undefined = undefined;
        for (var i = 0 ; i < this.sequence.sequenceStates.length; i++) {
            if (this.sequence.sequenceStates[i].state === fromState) {
                possibleNextStates = this.sequence.sequenceStates[i].possibleNextStates;
            }
        }
        if (!possibleNextStates){
            throw new InvalidStateException();
        }
        // randomly choose the next state
        const idx = Math.floor(Math.random() * possibleNextStates.length);
        return possibleNextStates[idx];
    }

    nextFrame() {
        if (this.currentState.horizontalDirection === HorizontalDirection.left) {
            this.faceLeft();
        } else if (this.currentState.horizontalDirection === HorizontalDirection.right) {
            this.faceRight();
        }
        this.setAnimation(this.currentState.spriteLabel);

        // What's my buddy doing?
        if (this.hasFriend() && this.currentStateEnum !== States.chaseFriend){
            if (this.friend().isPlaying() && !isStateAboveGround(this.currentStateEnum))
            {
                this.currentState = resolveState(States.chaseFriend, this);
                this.currentStateEnum = States.chaseFriend;
                return;
            }
        }

        var frameResult = this.currentState.nextFrame();
        if (frameResult === FrameResult.stateComplete)
        {
            // If recovering from swipe..
            if (this.holdState && this.holdStateEnum){
                this.currentState = this.holdState;
                this.currentStateEnum = this.holdStateEnum;
                this.holdState = undefined;
                this.holdStateEnum = undefined;
                return;
            }

            var nextState = this.chooseNextState(this.currentStateEnum);
            this.currentState = resolveState(nextState, this);
            this.currentStateEnum = nextState;
        } else if (frameResult === FrameResult.stateCancel){
            if (this.currentStateEnum === States.chase) {
                var nextState = this.chooseNextState(States.idleWithBall);
                this.currentState = resolveState(nextState, this);
                this.currentStateEnum = nextState;
            } else if (this.currentStateEnum === States.chaseFriend) {
                var nextState = this.chooseNextState(States.idleWithBall);
                this.currentState = resolveState(nextState, this);
                this.currentStateEnum = nextState;
            }
        }
    }

    hasFriend() : boolean {
        return this._friend !== undefined;
    }

    friend() : IPetType { 
        return this._friend!;
    }

    name(): string {
        return this.label;
    }

    makeFriendsWith(friend: IPetType): boolean {
        this._friend = friend;
        console.log(this.name(), ": I'm now friends ❤️ with ", friend.name());
        return true;
    }

    isPlaying(): boolean {
        return this.currentStateEnum === States.runRight || this.currentStateEnum === States.runLeft ;
    }
}

export class Totoro extends BasePetType {
    label = "totoro";
    sequence = {
        startingState: States.sitIdle,
        sequenceStates: [
            {
                state: States.sitIdle,
                possibleNextStates: [States.walkRight, States.lie]
            },
            {
                state: States.lie,
                possibleNextStates: [States.walkRight, States.walkLeft]
            },
            {
                state: States.walkRight,
                possibleNextStates: [States.walkLeft, States.sitIdle]
            },
            {
                state: States.walkLeft,
                possibleNextStates: [States.sitIdle, States.climbWallLeft, States.sitIdle]
            },
            {
                state: States.climbWallLeft,
                possibleNextStates: [States.wallHangLeft]
            },
            {
                state: States.wallHangLeft,
                possibleNextStates: [States.jumpDownLeft]
            },
            {
                state: States.jumpDownLeft,
                possibleNextStates: [States.land]
            },
            {
                state: States.land,
                possibleNextStates: [States.sitIdle, States.walkRight, States.lie]
            },
            {
                state: States.chase,
                possibleNextStates: [States.idleWithBall]
            },
            {
                state: States.idleWithBall,
                possibleNextStates: [States.walkRight, States.walkLeft]
            },
        ]
    };
}
export class Cat extends BasePetType {
    label = "cat";
    sequence = {
        startingState: States.sitIdle,
        sequenceStates: [
            {
                state: States.sitIdle,
                possibleNextStates: [States.walkRight, States.runRight]
            },
            {
                state: States.walkRight,
                possibleNextStates: [States.walkLeft, States.runLeft]
            },
            {
                state: States.runRight,
                possibleNextStates: [States.walkLeft, States.runLeft]
            },
            {
                state: States.walkLeft,
                possibleNextStates: [States.sitIdle, States.climbWallLeft, States.walkRight, States.runRight]
            },
            {
                state: States.runLeft,
                possibleNextStates: [States.sitIdle, States.climbWallLeft, States.walkRight, States.runRight]
            },
            {
                state: States.climbWallLeft,
                possibleNextStates: [States.wallHangLeft]
            },
            {
                state: States.wallHangLeft,
                possibleNextStates: [States.jumpDownLeft]
            },
            {
                state: States.jumpDownLeft,
                possibleNextStates: [States.land]
            },
            {
                state: States.land,
                possibleNextStates: [States.sitIdle, States.walkRight, States.runRight]
            },
            {
                state: States.chase,
                possibleNextStates: [States.idleWithBall]
            },
            {
                state: States.idleWithBall,
                possibleNextStates: [States.walkRight, States.walkLeft, States.runLeft, States.runRight]
            },
        ]
    };
}

export class Dog extends BasePetType {
    label = "dog";
    sequence = {
        startingState: States.sitIdle,
        sequenceStates: [
            {
                state: States.sitIdle,
                possibleNextStates: [States.walkRight, States.runRight, States.lie]
            },
            {
                state: States.lie,
                possibleNextStates: [States.walkRight, States.runRight]
            },
            {
                state: States.walkRight,
                possibleNextStates: [States.walkLeft, States.runLeft]
            },
            {
                state: States.runRight,
                possibleNextStates: [States.walkLeft, States.runLeft]
            },
            {
                state: States.walkLeft,
                possibleNextStates: [States.sitIdle, States.lie, States.walkRight, States.runRight]
            },
            {
                state: States.runLeft,
                possibleNextStates: [States.sitIdle, States.lie, States.walkRight, States.runRight]
            },
            {
                state: States.chase,
                possibleNextStates: [States.idleWithBall]
            },
            {
                state: States.idleWithBall,
                possibleNextStates: [States.walkRight, States.walkLeft, States.runLeft, States.runRight]
            },
        ]
    };
}

export class Snake extends BasePetType {
    label = "snake";
    sequence = {
        startingState: States.sitIdle,
        sequenceStates: [
            {
                state: States.sitIdle,
                possibleNextStates: [States.walkRight, States.runRight]
            },
            {
                state: States.walkRight,
                possibleNextStates: [States.walkLeft, States.runLeft]
            },
            {
                state: States.runRight,
                possibleNextStates: [States.walkLeft, States.runLeft]
            },
            {
                state: States.walkLeft,
                possibleNextStates: [States.sitIdle, States.walkRight, States.runRight]
            },
            {
                state: States.runLeft,
                possibleNextStates: [States.sitIdle, States.walkRight, States.runRight]
            },
            {
                state: States.chase,
                possibleNextStates: [States.idleWithBall]
            },
            {
                state: States.idleWithBall,
                possibleNextStates: [States.walkRight, States.walkLeft, States.runLeft, States.runRight]
            },
        ]
    };
}

export class Clippy extends BasePetType {
    label = "clippy";
    sequence = {
        startingState: States.sitIdle,
        sequenceStates: [
            {
                state: States.sitIdle,
                possibleNextStates: [States.walkRight, States.runRight]
            },
            {
                state: States.walkRight,
                possibleNextStates: [States.walkLeft, States.runLeft]
            },
            {
                state: States.runRight,
                possibleNextStates: [States.walkLeft, States.runLeft]
            },
            {
                state: States.walkLeft,
                possibleNextStates: [States.sitIdle]
            },
            {
                state: States.runLeft,
                possibleNextStates: [States.sitIdle]
            },
            {
                state: States.chase,
                possibleNextStates: [States.idleWithBall]
            },
            {
                state: States.idleWithBall,
                possibleNextStates: [States.walkRight, States.walkLeft, States.runLeft, States.runRight]
            },
        ]
    };
}

export class RubberDuck extends BasePetType {
    label = "rubber-duck";
    sequence = {
        startingState: States.sitIdle,
        sequenceStates: [
            {
                state: States.sitIdle,
                possibleNextStates: [States.walkRight, States.runRight]
            },
            {
                state: States.walkRight,
                possibleNextStates: [States.walkLeft, States.runLeft]
            },
            {
                state: States.runRight,
                possibleNextStates: [States.walkLeft, States.runLeft]
            },
            {
                state: States.walkLeft,
                possibleNextStates: [States.sitIdle]
            },
            {
                state: States.runLeft,
                possibleNextStates: [States.sitIdle]
            },
            {
                state: States.chase,
                possibleNextStates: [States.idleWithBall]
            },
            {
                state: States.idleWithBall,
                possibleNextStates: [States.walkRight, States.walkLeft, States.runLeft, States.runRight]
            },
        ]
    };
}

export class Crab extends BasePetType {
    label = "crab";
    sequence = {
        startingState: States.sitIdle,
        sequenceStates: [
            {
                state: States.sitIdle,
                possibleNextStates: [States.walkRight, States.runRight]
            },
            {
                state: States.walkRight,
                possibleNextStates: [States.walkLeft, States.runLeft]
            },
            {
                state: States.runRight,
                possibleNextStates: [States.walkLeft, States.runLeft]
            },
            {
                state: States.walkLeft,
                possibleNextStates: [States.sitIdle]
            },
            {
                state: States.runLeft,
                possibleNextStates: [States.sitIdle]
            },
            {
                state: States.chase,
                possibleNextStates: [States.idleWithBall]
            },
            {
                state: States.idleWithBall,
                possibleNextStates: [States.walkRight, States.walkLeft, States.runLeft, States.runRight]
            },
        ]
    };
}

export class InvalidPetException {
}

export function createPet(petType: string, el: HTMLImageElement, collision: HTMLDivElement, size: PetSize, left: number, bottom: number, petRoot: string, floor: number) : IPetType {
    if (petType === "totoro"){
        return new Totoro(el, collision, size, left, bottom, petRoot, floor);
    }
    if (petType === "cat"){
        return new Cat(el, collision, size, left, bottom, petRoot, floor);
    }
    else if (petType === "dog") {
        return new Dog(el, collision, size, left, bottom, petRoot, floor);
    }
    else if (petType === "snake") {
        return new Snake(el, collision, size, left, bottom, petRoot, floor);
    }
    else if (petType === "clippy") {
        return new Clippy(el, collision, size, left, bottom, petRoot, floor);
    }
    else if (petType === "crab") {
        return new Crab(el, collision, size, left, bottom, petRoot, floor);
    }
    else if (petType === "rubber-duck") {
        return new RubberDuck(el, collision, size, left, bottom, petRoot, floor);
    }
    throw new InvalidPetException();
}

