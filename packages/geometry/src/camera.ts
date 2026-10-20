import type {WallDefinition,Vec3} from '@climbed/contracts';
import {Quaternion,Vector3} from 'three';

/** Keep room vertical independent of a panel's tilt, including when viewing a roof. */
export function wallFocusPose(wall:WallDefinition,aspect:number) {
  const q=new Quaternion(...wall.rotation);
  const target=new Vector3(0,wall.height/2,0).applyQuaternion(q).add(new Vector3(...wall.position));
  const direction=new Vector3(0,0,1).applyQuaternion(q);
  if(Math.abs(direction.y)>.98) {
    // A view parallel to world-up has no stable horizon. Approach a horizontal
    // panel obliquely rather than replacing the room's up vector with its axes.
    const across=new Vector3(0,1,0).applyQuaternion(q);across.y=0;
    if(across.lengthSq()<1e-8)across.set(0,0,1);
    direction.add(across.normalize().multiplyScalar(.35)).normalize();
  }
  const distance=Math.max(wall.width/Math.max(aspect,.1),wall.height,1)/(2*Math.tan(21*Math.PI/180))*1.3;
  return {target:target.toArray() as Vec3,position:target.clone().addScaledVector(direction,distance).toArray() as Vec3,up:[0,1,0] as Vec3};
}
