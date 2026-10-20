import {describe,expect,it} from 'vitest';
import {createDemoScene} from '@climbed/contracts';
import {Vector3} from 'three';
import {createWallChain,getPlanWalls,projectWallBase,quaternionFromWallAngles,wallFocusPose} from '../src/index';

describe('plan limité aux pieds de murs et caméra avec verticale de salle',()=>{
  it('masque le toit de la salle existante sans supprimer le dévers ni changer ses données',()=>{
    const scene=createDemoScene(),before=structuredClone(scene);
    expect(getPlanWalls(scene).map(w=>w.id)).toEqual(['wall-main','wall-side']);
    const base=projectWallBase(scene.walls[0]!);
    expect(Math.max(...base.map(p=>p[1]))).toBeCloseTo(0);
    expect(Math.min(...base.map(p=>p[1]))).toBeGreaterThan(-.19);
    expect(scene).toEqual(before);
  });
  it('ne garde que le premier pan des profils 0°,30°,0° et masque un toit distant',()=>{
    const scene=createDemoScene();scene.placements=[];scene.boulders=[];
    scene.walls=createWallChain({origin:[0,0,0],width:3,thickness:.18,segments:[{length:1,inclination:0},{length:1,inclination:30},{length:1,inclination:0}],color:'#dddddd',fixingSpacing:.25,idPrefix:'profile'});
    scene.walls.push({...scene.walls[0]!,id:'far-roof',position:[100,10,100],rotation:quaternionFromWallAngles(90)});
    expect(getPlanWalls(scene).map(w=>w.id)).toEqual(['profile-1']);
    expect(projectWallBase(getPlanWalls(scene)[0]!)).toEqual([[-1.5,-.18],[1.5,-.18],[1.5,0],[-1.5,0]]);
  });
  it('conserve deux pans indépendants à des altitudes différentes et les profils d’un autre niveau',()=>{
    const scene=createDemoScene(),base=scene.walls[1]!;
    scene.levels=[{id:'ground',name:'Sol',elevation:0,outline:[[-5,-5],[5,-5],[5,5],[-5,5]]},{id:'upper',name:'Étage',elevation:3.5,outline:[[-5,-5],[5,-5],[5,5],[-5,5]]}];
    scene.walls=[{...base,id:'lower',levelId:'ground',height:3.5,position:[0,0,0]},{...base,id:'upper-panel',levelId:'upper',position:[0,3.5,0]},{...base,id:'separate',position:[4,1,0]}];
    expect(getPlanWalls(scene).map(w=>w.id)).toEqual(['lower','upper-panel','separate']);
  });
  it.each([0,15,30,85,90,-90,120])('conserve Y comme verticale et un horizon stable pour un pan à %s°',inclination=>{
    const wall={...createDemoScene().walls[0]!,rotation:quaternionFromWallAngles(inclination,40)};
    const pose=wallFocusPose(wall,1.5),position=new Vector3(...pose.position),target=new Vector3(...pose.target),up=new Vector3(...pose.up);
    const direction=position.clone().sub(target).normalize(),right=new Vector3().crossVectors(up,direction).normalize();
    expect(pose.up).toEqual([0,1,0]);expect(right.y).toBeCloseTo(0);
    expect(direction.clone().cross(up).length()).toBeGreaterThan(.1);
    expect(position.toArray().every(Number.isFinite)).toBe(true);
    expect(position.distanceTo(target)).toBeGreaterThan(1);
  });
});
