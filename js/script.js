import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';    



let container;
let camera, scene, renderer;





let reticle;
let pmremGenerator;
let current_object;
let controls;
let envmap;

let current_url = "1";
let touchDown, touchX, touchY, deltaX, deltaY;

$(".ar-object").click(function () {
    current_url = $(this).attr("id");

    if (!renderer.xr.isPresenting) {

        if (current_object != null) {
            scene.remove(current_object);
        }

        loadModel(current_url);
    }
});


let hitTestSource = null;
let hitTestSourceRequested = false;


function loadModel(model) {
    new RGBELoader()
        .setDataType(THREE.HalfFloatType)
        .setPath('textures/') 
        .load('aarfontein_dawn_2_4k.hdr', function (texture) { 
            envmap = pmremGenerator.fromEquirectangular(texture).texture;
            texture.flipY = false; 
            texture.premultiplyAlpha = false; 
            scene.environment = envmap;
            texture.dispose();
            pmremGenerator.dispose();
            render();
            var loader = new GLTFLoader().setPath('3d/'); 
            loader.load(model + ".glb", function (glb) {
                current_object = glb.scene;
                current_object.visible = false;           
                scene.add(current_object);          
                     
                render();      
            });      
        });

}


init();


function init() {

    container = document.createElement('div');
    document.body.appendChild(container);


    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.01,
        20
    );


    const directionalLight = new THREE.DirectionalLight(0xdddddd, 1);
    directionalLight.position.set(0, 0, 1).normalize();
    scene.add(directionalLight);


    const ambientLight = new THREE.AmbientLight(0x222222);
    scene.add(ambientLight);


    const hemisphereLight = new THREE.HemisphereLight(
        0xffffff,
        0xbbbbff,
        1
    );

    hemisphereLight.position.set(0.5, 1, 0.25);

    scene.add(hemisphereLight);


    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });

    renderer.setPixelRatio(window.devicePixelRatio);

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    

    renderer.xr.enabled = true;
    renderer.setAnimationLoop(animate);


    container.appendChild(renderer.domElement);
    renderer.domElement.addEventListener('touchstart', function(e) {
        e.preventDefault();
        touchDown = true;
        touchX = e.touches[0].pageX;
        touchY = e.touches[0].pageY;
    }, false);
    
    
    renderer.domElement.addEventListener('touchend', function(e) {
        e.preventDefault();
        touchDown = false;
    }, false);
    
    
    renderer.domElement.addEventListener('touchmove', function(e) {
        e.preventDefault();
    
        if (!touchDown) {
            return;
        }
    
        deltaX = e.touches[0].pageX - touchX;
        deltaY = e.touches[0].pageY - touchY;
    
        touchX = e.touches[0].pageX;
        touchY = e.touches[0].pageY;
    
        rotateObject();
    
    }, false);
    


    controls = new OrbitControls(camera, renderer.domElement);
    controls.addEventListener('change', render);
    controls.minDistance = 2;
    controls.maxDistance = 10;
    controls.target.set(0, 0, -0.2);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;


    pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();


    let options = {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
    };
    
    options.domOverlay = {root: document.getElementById('content')};
    document.body.appendChild(ARButton.createButton(renderer, options));


    $("#place-button").click(function () {
        arPlace();
    });
    
    function arPlace() {
    
        if (reticle.visible && current_object) {
    
            current_object.position.setFromMatrixPosition(reticle.matrix);
            current_object.visible = true;
        }
    }
    
    
    


    reticle = new THREE.Mesh(

        new THREE.RingGeometry(
            0.15,
            0.2,
            32
        ).rotateX(-Math.PI / 2),

        new THREE.MeshBasicMaterial({
            color: 0xffffff
        })
    );
    
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    
    scene.add(reticle);


    window.addEventListener(
        'resize',
        onWindowResize
    );


    loadModel(current_url);

}

function rotateObject() {

    if (current_object && reticle.visible) {
        current_object.rotation.y += deltaX / 100;

    }

}


function onWindowResize() {

    camera.aspect =
        window.innerWidth /
        window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

}


function animate(timestamp, frame) {

    if (frame) {

        const referenceSpace =
            renderer.xr.getReferenceSpace();

        const session =
            renderer.xr.getSession();

        if (hitTestSourceRequested === false) {

            session
                .requestReferenceSpace('viewer')
                .then(function (referenceSpace) {

                    session
                        .requestHitTestSource({
                            space: referenceSpace
                        })
                        .then(function (source) {

                            hitTestSource = source;

                        });

                });


                session.addEventListener('end', function () {
                    hitTestSourceRequested = false;               
                    hitTestSource = null;               
                    reticle.visible = false;               
                    
                        var box = new THREE.Box3();
                        box.setFromObject(current_object);
                        box.getCenter(controls.target);
                        controls.update();
                                               
                    document.getElementById("place-button").style.display = "none";
                
                });
                


            hitTestSourceRequested = true;

        }

        if (hitTestSource) {

            const hitTestResults =
                frame.getHitTestResults(hitTestSource);
        
            console.log("Hit test :", hitTestResults.length);
        
            if (hitTestResults.length) {
        
                console.log("SURFACE DETECTEE");
        
                const hit = hitTestResults[0];
        
                reticle.visible = true;
        
                reticle.matrix.fromArray(
                    hit
                        .getPose(referenceSpace)
                        .transform
                        .matrix
                );
        
                document.getElementById("place-button").style.display = "block";
        
            } else {
        
                console.log("Aucune surface");
        
                reticle.visible = false;
        
                document.getElementById("place-button").style.display = "none";
        
            }
        }
        

    }

    renderer.render(
        scene,
        camera
    );


}



function render() {
    renderer.render(scene, camera);
}


