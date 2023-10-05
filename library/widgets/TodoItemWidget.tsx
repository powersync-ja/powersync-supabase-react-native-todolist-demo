import React from "react";
import {ActivityIndicator, Alert, View, Modal, StyleSheet,} from "react-native";
import {ListItem, Button, Icon, Image} from "react-native-elements";
import {TodoModel} from "../models/TodoModel";
import {CameraWidget} from "./CameraWidget";

export interface TodoItemWidgetProps {
    model: TodoModel,
}

export const TodoItemWidget: React.FC<TodoItemWidgetProps> = (props) => {
    const {model} = props;
    const [loading, setLoading] = React.useState(false);
    const [isCameraVisible, setCameraVisible] = React.useState(false);

    const handleCancel = () => {
        setCameraVisible(false);
    };


    return (
        <View key={`todo-item-${model.id}`} style={{padding: 10}}>
            <Modal
                animationType="slide"
                transparent={false}
                visible={isCameraVisible}
                onRequestClose={handleCancel}
            >
                <CameraWidget
                    onCapture={(data) => {
                        model.setPhoto(data);
                        handleCancel();
                    }}
                    onClose={handleCancel}
                />
            </Modal>
            <ListItem.Swipeable
                bottomDivider
                rightContent={
                    <Button
                        containerStyle={{
                            flex: 1,
                            justifyContent: "center",
                            backgroundColor: "#d3d3d3",
                        }}
                        type="clear"
                        icon={{name: "delete", color: "red"}}
                        onPress={() => {
                            Alert.alert(
                                "Confirm",
                                "This item will be permanently deleted",
                                [
                                    {text: "Cancel"},
                                    {text: "Delete", onPress: () => model.delete()},
                                ],
                                {cancelable: true}
                            );
                        }}
                    />
                }
            >
                {loading ? (
                    <ActivityIndicator/>
                ) : (
                    <ListItem.CheckBox
                        iconType="material-community"
                        checkedIcon="checkbox-marked"
                        uncheckedIcon="checkbox-blank-outline"
                        checked={model.record.completed}
                        onPress={async () => {
                            setLoading(true);
                            try {
                                await model.toggleCompletion(!model.record.completed);
                            } catch (ex) {
                                console.error(ex);
                            } finally {
                                setLoading(false);
                            }
                        }}
                    />
                )}
                <ListItem.Content style={{minHeight: 80}}>
                    <ListItem.Title>{model.record.description}</ListItem.Title>
                </ListItem.Content>
                {model.record.photo_id == null ? (
                        <Icon name={'camera'} type='font-awesome' onPress={() => setCameraVisible(true)}/>) :
                    <Image
                        source={{uri: `https://source.unsplash.com/random`}}
                        containerStyle={styles.item}
                        PlaceholderContent={<ActivityIndicator/>}
                    />
                }
            </ListItem.Swipeable>
        </View>
    );
};


const styles = StyleSheet.create({

    item: {
        aspectRatio: 1,
        width: '100%',
        flex: 1,
    },
});