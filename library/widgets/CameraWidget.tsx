import React, {useRef} from 'react';
import {View, TouchableOpacity, Text, StyleSheet} from 'react-native';
import {Camera, CameraType, CameraCapturedPicture} from 'expo-camera';
import {Button} from 'react-native-elements';

export interface Props {
    onCapture: (data: CameraCapturedPicture) => void;
    onClose: () => void;
}

export const CameraWidget: React.FC<Props> = props => {
    const cameraRef = useRef<Camera>(null);
    const [type, setType] = React.useState(CameraType.back);
    const [permission, requestPermission] = Camera.useCameraPermissions();
    const [ready, setReady] = React.useState(false);

    function toggleCameraType() {
        setType(current => (current === CameraType.back ? CameraType.front : CameraType.back));
    }

    const takePhoto = async () => {
        if (cameraRef.current && ready) {
            const options = {quality: 0.5, base64: true};
            const data = await cameraRef.current.takePictureAsync(options);
            props.onCapture(data);
        }
    };

    if (!permission) {
        // Camera permissions are still loading
        return <View/>;
    }

    if (!permission.granted) {
        // Camera permissions are not granted yet
        return (
            <View style={styles.container}>
                <Text style={{textAlign: 'center'}}>We need your permission to show the camera</Text>
                <Button onPress={requestPermission} title="grant permission"/>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Camera ref={cameraRef} style={styles.camera} type={type} onCameraReady={() => setReady(true)}>
                <View style={styles.buttonContainer}>
                    <TouchableOpacity style={styles.buttonCapture} onPress={takePhoto}>
                        <Text style={styles.text}>Capture</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.buttonFlip} onPress={toggleCameraType}>
                        <Text style={styles.text}>Flip Camera</Text>
                    </TouchableOpacity>
                </View>
            </Camera>
        </View>
    );
};


const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
    },
    camera: {
        flex: 1,
    },
    buttonContainer: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: 'transparent',
        alignItems: 'flex-end',
        margin: 64,
    },
    buttonCapture: {
        flex: 1,
        alignItems: 'center'
    },
    buttonFlip: {
        flex: 1,
        alignItems: 'center',
    },
    text: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
    },
});

